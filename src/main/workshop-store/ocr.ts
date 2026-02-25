import type {
  WorkshopOcrExtractTextInput,
  WorkshopOcrExtractTextResult,
  WorkshopOcrPriceImportInput,
  WorkshopOcrPriceImportResult,
} from "../../shared/types";
import {
  cleanupWorkshopOcrEngineCore,
  extractWorkshopOcrTextCore,
  importWorkshopOcrPricesCore,
} from "../workshop-store-core";

export function cleanupWorkshopOcrEngine(): void {
  cleanupWorkshopOcrEngineCore();
}

export async function extractWorkshopOcrText(payload: WorkshopOcrExtractTextInput): Promise<WorkshopOcrExtractTextResult> {
  return extractWorkshopOcrTextCore(payload);
}

export async function importWorkshopOcrPrices(payload: WorkshopOcrPriceImportInput): Promise<WorkshopOcrPriceImportResult> {
  return importWorkshopOcrPricesCore(payload);
}
