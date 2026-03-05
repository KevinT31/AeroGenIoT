import { IsIn } from "class-validator";

export class ReportFeedbackDto {
  @IsIn(["mejoro", "igual", "empeoro"])
  value: "mejoro" | "igual" | "empeoro";
}
