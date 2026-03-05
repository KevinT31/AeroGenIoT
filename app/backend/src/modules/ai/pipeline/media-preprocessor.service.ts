import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";
import { AiDiagnosisDto, ORGAN_VALUES, OrganType } from "../dto.ai-diagnosis";
import { clamp01, normalizeText } from "./text.utils";
import { ChatContext, ImageItem, InputBundle, MediaBundle, QualityFlags } from "./types";

type BuildInputBundleParams = {
  dto: AiDiagnosisDto;
  crop: string;
  variety?: string | null;
  growthStage?: string | null;
  location: {
    countryCode: string;
    region?: string | null;
    lat?: number | null;
    lon?: number | null;
    accuracyM?: number | null;
  };
};

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

@Injectable()
export class AiMediaPreprocessorService {
  constructor() {
    if (typeof ffmpegPath === "string" && ffmpegPath.length) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
    if ((ffprobeStatic as any)?.path) {
      ffmpeg.setFfprobePath((ffprobeStatic as any).path);
    }
  }

  async buildInputBundle(params: BuildInputBundleParams): Promise<InputBundle> {
    const { dto, crop, variety, growthStage, location } = params;
    this.validateMediaShape(dto);

    const requestId = randomUUID();
    const tempRoot = path.resolve("tmp", "ai", requestId);
    await fs.mkdir(tempRoot, { recursive: true });

    const hasVideo = Boolean(dto.media.video);
    const images = hasVideo
      ? await this.prepareFromVideo(dto.media.video || "", dto.media.organsHint, dto.media.videoDurationSec, tempRoot)
      : await this.prepareFromPhotos(dto.media.photos || [], dto.media.organsHint, tempRoot);

    const totalBytes = images.reduce((sum, item) => sum + item.bytes, 0);
    const media: MediaBundle = {
      type: hasVideo ? "video" : "photo",
      source_count: hasVideo ? 1 : (dto.media.photos || []).length,
      images,
      total_bytes: totalBytes,
      within_limits: {
        max_images_plantnet: images.length <= this.maxImagesPlantNet,
        max_total_size_plantnet: totalBytes <= this.maxTotalBytes,
      },
      original_video_uri: hasVideo ? dto.media.video || null : null,
      frames_extracted: hasVideo ? images.length : null,
    };

    const audioNoteUrl = this.readAudioNoteUrl(dto.answers);
    const chatContext: ChatContext = {
      notes: this.readText(dto.notes),
      audio_note_url: audioNoteUrl,
      has_audio_note: Boolean(audioNoteUrl),
    };

    if (!media.within_limits.max_images_plantnet) {
      throw new BadRequestException(`Pl@ntNet acepta maximo ${this.maxImagesPlantNet} imagenes.`);
    }
    if (!media.within_limits.max_total_size_plantnet) {
      throw new BadRequestException("El peso total excede 50MB.");
    }

    return {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      lang: this.normalizeLang(dto.lang),
      crop_context: {
        crop: normalizeText(crop) || "unknown",
        variety: variety || null,
        growth_stage: growthStage || null,
      },
      location: {
        country_code: (location.countryCode || "PE").trim().toUpperCase(),
        region: location.region || null,
        lat: this.numberOrNull(location.lat),
        lon: this.numberOrNull(location.lon),
        accuracy_m: this.numberOrNull(location.accuracyM),
      },
      media,
      organs_hint_ui: {
        user_selected: Array.isArray(dto.media.organsHint) && dto.media.organsHint.length > 0,
        allowed_values: [...ORGAN_VALUES],
      },
      chat_context: chatContext,
    };
  }

  private validateMediaShape(dto: AiDiagnosisDto) {
    if (!dto.media || typeof dto.media !== "object") {
      throw new BadRequestException("media es requerido.");
    }

    const hasPhotos = Array.isArray(dto.media.photos) && dto.media.photos.length > 0;
    const hasVideo = Boolean(dto.media.video);

    if (hasPhotos === hasVideo) {
      throw new BadRequestException("Debes enviar solo media.photos[] o media.video.");
    }

    if (hasPhotos && (dto.media.photos || []).length > this.maxImagesPlantNet) {
      throw new BadRequestException(`Pl@ntNet acepta maximo ${this.maxImagesPlantNet} imagenes.`);
    }

    if (dto.media.organsHint && dto.media.organsHint.length) {
      const invalid = dto.media.organsHint
        .map((item) => normalizeText(item) as OrganType)
        .find((item) => !ORGAN_VALUES.includes(item));
      if (invalid) {
        throw new BadRequestException(`organ invalido: ${invalid}`);
      }

      if (hasPhotos) {
        const len = dto.media.organsHint.length;
        const photosLen = (dto.media.photos || []).length;
        if (len !== 1 && len !== photosLen) {
          throw new BadRequestException("organs_hint debe tener 1 valor o el mismo numero de fotos.");
        }
      }

      if (hasVideo && dto.media.organsHint.length !== 1) {
        throw new BadRequestException("Para video, organs_hint debe tener un solo valor.");
      }
    }
  }

  private async prepareFromPhotos(photoUrls: string[], organsHint: string[] | undefined, tempRoot: string) {
    const downloaded = await Promise.all(photoUrls.map((url, idx) => this.downloadMedia(url, tempRoot, `photo_${idx + 1}`)));
    const normalized = await Promise.all(downloaded.map((item, idx) => this.normalizeToImage(item, tempRoot, `img_${idx + 1}`)));
    const compressed = await this.compressIfNeeded(normalized, tempRoot);
    const organs = this.expandOrgans(organsHint, compressed.length, "leaf");
    const images = await Promise.all(compressed.map((filePath, idx) => this.buildImageItem(filePath, `img_${idx + 1}`, organs[idx])));

    this.validatePhotoQuality(images);
    return images;
  }

  private async prepareFromVideo(videoUrl: string, organsHint: string[] | undefined, durationHint: number | undefined, tempRoot: string) {
    const sourceVideoPath = await this.downloadMedia(videoUrl, tempRoot, "video_source");
    const metadata = await this.readVideoMetadata(sourceVideoPath);
    const maxVideoSeconds = this.maxVideoSeconds;

    const sourceDurationSec = metadata.durationSec || durationHint || 0;
    const shouldTrim = sourceDurationSec > maxVideoSeconds + 0.05;
    const videoPath = shouldTrim
      ? await this.trimVideoToMaxDuration(sourceVideoPath, tempRoot, maxVideoSeconds)
      : sourceVideoPath;

    const effectiveDurationSec = shouldTrim
      ? (await this.readVideoMetadata(videoPath).then((item) => item.durationSec).catch(() => maxVideoSeconds)) || maxVideoSeconds
      : sourceDurationSec;

    const targetFrames = Math.min(Math.max(this.videoFramesTarget, this.minVideoFrames), 5);
    const sampleSize = Math.max(targetFrames * 2, targetFrames);
    const frameCandidates = await this.extractFrameCandidates(
      videoPath,
      tempRoot,
      sampleSize,
      Math.min(Math.max(effectiveDurationSec, 0), maxVideoSeconds),
    );

    if (!frameCandidates.length) {
      throw new BadRequestException("No se pudieron extraer frames utiles del video.");
    }

    frameCandidates.sort((a, b) => b.quality.quality_score - a.quality.quality_score);
    const selected = frameCandidates.slice(0, targetFrames);

    if (selected.length < this.minVideoFrames) {
      throw new BadRequestException(`Se requieren al menos ${this.minVideoFrames} frames utiles. Repite el video.`);
    }

    const selectedPaths = selected.map((item) => item.path);
    const compressed = await this.compressIfNeeded(selectedPaths, tempRoot);
    const organs = this.expandOrgans(organsHint, compressed.length, "auto");
    return Promise.all(compressed.map((filePath, idx) => this.buildImageItem(filePath, `frame_${idx + 1}`, organs[idx])));
  }

  private trimVideoToMaxDuration(sourcePath: string, tempRoot: string, maxSeconds: number) {
    const targetPath = path.join(tempRoot, `video_trimmed_${Math.floor(maxSeconds)}s.mp4`);
    return new Promise<string>((resolve, reject) => {
      ffmpeg(sourcePath)
        .setStartTime(0)
        .setDuration(maxSeconds)
        .outputOptions(["-movflags +faststart"])
        .output(targetPath)
        .on("end", () => resolve(targetPath))
        .on("error", (error) => reject(error))
        .run();
    });
  }

  private async extractFrameCandidates(videoPath: string, tempRoot: string, sampleSize: number, durationSec: number) {
    const framesDir = path.join(tempRoot, "frames");
    await fs.mkdir(framesDir, { recursive: true });

    const safeDuration = durationSec > 0.2 ? durationSec : 1;
    const start = Math.min(0.1, Math.max(0, safeDuration / 10));
    const end = Math.max(start, safeDuration - 0.1);
    const times = this.linspace(start, end, sampleSize);

    const output: Array<{ path: string; quality: QualityFlags }> = [];
    for (let index = 0; index < times.length; index += 1) {
      const framePath = path.join(framesDir, `frame_raw_${index + 1}.jpg`);
      try {
        await this.extractSingleFrame(videoPath, framePath, times[index]);
        const quality = await this.computeQualityFlags(framePath);
        output.push({ path: framePath, quality });
      } catch {
        // Ignoramos frames defectuosos y seguimos con el resto.
      }
    }

    return output;
  }

  private extractSingleFrame(videoPath: string, framePath: string, second: number) {
    return new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(["-frames:v 1", "-q:v 2"])
        .seekInput(second)
        .output(framePath)
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .run();
    });
  }

  private readVideoMetadata(videoPath: string) {
    return new Promise<{ durationSec: number }>((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, data) => {
        if (error) {
          reject(error);
          return;
        }
        const rawDuration = Number((data?.format as any)?.duration || 0);
        resolve({ durationSec: Number.isFinite(rawDuration) ? rawDuration : 0 });
      });
    });
  }

  private async downloadMedia(source: string, tempRoot: string, prefix: string) {
    if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new BadRequestException(`No se pudo descargar media: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = this.extensionFromSource(source, response.headers.get("content-type") || undefined) || ".bin";
      const target = path.join(tempRoot, `${prefix}_${randomUUID()}${ext}`);
      await fs.writeFile(target, buffer);
      return target;
    }

    const localPath = source.replace(/^file:\/\//i, "");
    await fs.access(localPath);
    return path.resolve(localPath);
  }

  private async normalizeToImage(sourcePath: string, tempRoot: string, fileId: string) {
    const outPath = path.join(tempRoot, `${fileId}.jpg`);
    await sharp(sourcePath).rotate().jpeg({ quality: 92 }).toFile(outPath);
    return outPath;
  }

  private async compressIfNeeded(paths: string[], tempRoot: string) {
    const total = await this.totalBytes(paths);
    if (total <= this.maxTotalBytes) return paths;

    const compressedDir = path.join(tempRoot, "compressed");
    await fs.mkdir(compressedDir, { recursive: true });

    const output: string[] = [];
    for (const item of paths) {
      const parsed = path.parse(item);
      const target = path.join(compressedDir, `${parsed.name}.jpg`);
      await sharp(item)
        .rotate()
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(target);
      output.push(target);
    }

    const compressedBytes = await this.totalBytes(output);
    if (compressedBytes > this.maxTotalBytes) {
      throw new BadRequestException("No fue posible reducir imagenes por debajo de 50MB.");
    }

    return output;
  }

  private async buildImageItem(filePath: string, imageId: string, organ: OrganType): Promise<ImageItem> {
    const stats = await fs.stat(filePath);
    const quality = await this.computeQualityFlags(filePath);

    return {
      image_id: imageId,
      mime: this.mimeFromPath(filePath),
      bytes: stats.size,
      sha256: await this.sha256(filePath),
      uri: filePath,
      organ,
      quality,
    };
  }

  private async computeQualityFlags(filePath: string): Promise<QualityFlags> {
    const image = sharp(filePath).rotate().removeAlpha();
    const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);

    const channelMeans = (stats.channels || []).map((channel) => channel.mean || 0);
    const brightness = channelMeans.length ? channelMeans.reduce((sum, value) => sum + value, 0) / channelMeans.length : 120;

    let overexposedRatio = 0;
    const channels = stats.channels || [];
    if (channels.length && metadata.width && metadata.height) {
      const totalPixels = metadata.width * metadata.height * channels.length;
      const highValues = channels.reduce((sum, channel) => {
        const histogram = Array.isArray((channel as any).histogram) ? (channel as any).histogram : [];
        return sum + histogram.slice(245).reduce((acc: number, item: number) => acc + (Number(item) || 0), 0);
      }, 0);
      overexposedRatio = totalPixels > 0 ? highValues / totalPixels : 0;
    }

    const rawSharpness = Number((stats as any).sharpness || 0);
    const blurry = rawSharpness < 4.5;
    const lowLight = brightness < 55;
    const overexposed = overexposedRatio > 0.18;

    const sharpnessScore = clamp01(rawSharpness / 12);
    const lightBalanceScore = clamp01(1 - Math.abs(brightness - 128) / 128);
    const exposureScore = clamp01(1 - overexposedRatio * 2.5);
    const qualityScore = clamp01(sharpnessScore * 0.5 + lightBalanceScore * 0.35 + exposureScore * 0.15);

    return {
      blurry,
      low_light: lowLight,
      overexposed,
      quality_score: Number(qualityScore.toFixed(3)),
    };
  }

  private validatePhotoQuality(images: ImageItem[]) {
    if (!images.length) {
      throw new BadRequestException("No se encontraron fotos para analizar.");
    }

    const hasNonBlurry = images.some((item) => !item.quality.blurry);
    if (!hasNonBlurry) {
      throw new BadRequestException("Todas las fotos estan borrosas. Toma nuevas fotos con mejor enfoque.");
    }

    const minQuality = Number(process.env.MIN_PHOTO_QUALITY_SCORE || "0.2");
    const hasEnoughQuality = images.some((item) => item.quality.quality_score >= minQuality);
    if (!hasEnoughQuality) {
      throw new BadRequestException("Calidad insuficiente en fotos. Repite captura con mejor luz y enfoque.");
    }
  }

  private expandOrgans(organsHint: string[] | undefined, size: number, fallback: OrganType) {
    if (!organsHint?.length) {
      return Array.from({ length: size }, () => fallback);
    }

    const base = organsHint.length === 1 ? Array.from({ length: size }, () => organsHint[0]) : organsHint;
    if (base.length !== size) {
      throw new BadRequestException("organs_hint debe tener 1 valor o el mismo numero de imagenes.");
    }

    return base.map((item) => {
      const normalized = normalizeText(item) as OrganType;
      return ORGAN_VALUES.includes(normalized) ? normalized : "auto";
    });
  }

  private async totalBytes(paths: string[]) {
    const values = await Promise.all(paths.map((item) => fs.stat(item).then((stat) => stat.size)));
    return values.reduce((sum, value) => sum + value, 0);
  }

  private async sha256(filePath: string) {
    const buffer = await fs.readFile(filePath);
    return createHash("sha256").update(buffer).digest("hex");
  }

  private extensionFromSource(source: string, contentType?: string) {
    const fromUrl = path.extname(new URL(source).pathname || "").toLowerCase();
    if (ALLOWED_EXTENSIONS.has(fromUrl)) return fromUrl;

    if ((contentType || "").includes("png")) return ".png";
    if ((contentType || "").includes("jpeg") || (contentType || "").includes("jpg")) return ".jpg";
    if ((contentType || "").includes("mp4")) return ".mp4";
    return fromUrl || ".jpg";
  }

  private mimeFromPath(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".png") return "image/png";
    return "image/jpeg";
  }

  private normalizeLang(value?: string | null) {
    const candidate = (value || "es").trim().toLowerCase();
    return candidate || "es";
  }

  private readText(value: unknown) {
    if (typeof value !== "string") return null;
    const parsed = value.trim();
    return parsed.length ? parsed : null;
  }

  private readAudioNoteUrl(answers?: Record<string, string>) {
    if (!answers || typeof answers !== "object") return null;
    const candidate = answers.audio_note_url || answers.audioNoteUrl;
    if (typeof candidate !== "string") return null;
    const parsed = candidate.trim();
    return /^https?:\/\//i.test(parsed) ? parsed : null;
  }

  private numberOrNull(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private linspace(start: number, end: number, size: number) {
    if (size <= 1) return [start];
    const step = (end - start) / (size - 1);
    return Array.from({ length: size }, (_, index) => Number((start + step * index).toFixed(3)));
  }

  private get maxImagesPlantNet() {
    return Number(process.env.MAX_IMAGES_PLANTNET || "5");
  }

  private get maxTotalBytes() {
    const raw = Number(process.env.MAX_TOTAL_SIZE_PLANTNET_BYTES || `${50 * 1024 * 1024}`);
    return Number.isFinite(raw) && raw > 0 ? raw : 50 * 1024 * 1024;
  }

  private get videoFramesTarget() {
    return Number(process.env.VIDEO_FRAMES_TARGET || "5");
  }

  private get minVideoFrames() {
    return Number(process.env.MIN_VIDEO_FRAMES || "3");
  }

  private get maxVideoSeconds() {
    const raw = Number(process.env.MAX_VIDEO_DURATION_SECONDS || "5");
    return Number.isFinite(raw) && raw > 0 ? raw : 5;
  }
}
