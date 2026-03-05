import { Injectable } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { UploadPresignDto } from "./dto.uploads-presign";

@Injectable()
export class UploadsService {
  private s3: S3Client;
  private bucket: string;
  private region: string;
  private publicBase: string;
  private expiresIn: number;

  constructor() {
    this.region = process.env.S3_REGION || "us-east-1";
    this.bucket = process.env.S3_BUCKET || "";
    this.publicBase =
      process.env.S3_PUBLIC_BASE_URL || (this.bucket ? `https://${this.bucket}.s3.${this.region}.amazonaws.com` : "");
    this.expiresIn = Number(process.env.UPLOAD_URL_EXPIRES || "900");
    this.s3 = new S3Client({ region: this.region });
  }

  async createPresignedUrl(userId: string, dto: UploadPresignDto) {
    if (!this.bucket) {
      throw new Error("S3_BUCKET not configured");
    }

    const extension = (dto.extension || "jpg").replace(/[^a-zA-Z0-9]/g, "");
    const kind = dto.kind || "general";
    const key = `uploads/${userId}/${kind}/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: this.expiresIn });
    const fileUrl = this.publicBase ? `${this.publicBase}/${key}` : null;

    return { uploadUrl, fileUrl, key, expiresIn: this.expiresIn };
  }
}
