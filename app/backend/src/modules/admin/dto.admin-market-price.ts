import { IsDateString, IsNumber, IsString } from "class-validator";

export class AdminMarketPriceDto {
  @IsString()
  cropId: string;

  @IsString()
  zoneId: string;

  @IsDateString()
  date: string;

  @IsNumber()
  priceMin: number;

  @IsNumber()
  priceMax: number;

  @IsString()
  source: string;
}
