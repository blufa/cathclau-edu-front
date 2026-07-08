import { api } from "@/lib/api/client";
import type { DocumentTemplate, GeneratedDocument, TemplateInput, VariableGroup } from "@/lib/types/documents";

export function listTemplates(): Promise<DocumentTemplate[]> {
  return api.get<DocumentTemplate[]>("/documents/templates");
}
export function createTemplate(input: TemplateInput): Promise<DocumentTemplate> {
  return api.post<DocumentTemplate>("/documents/templates", input);
}
export function seedDefaultTemplates(): Promise<DocumentTemplate[]> {
  return api.post<DocumentTemplate[]>("/documents/templates/seed-defaults");
}
export function updateTemplate(id: number, input: TemplateInput): Promise<DocumentTemplate> {
  return api.put<DocumentTemplate>(`/documents/templates/${id}`, input);
}
export function setDefaultTemplate(id: number): Promise<DocumentTemplate> {
  return api.patch<DocumentTemplate>(`/documents/templates/${id}/default`);
}
export function deleteTemplate(id: number): Promise<void> {
  return api.delete<void>(`/documents/templates/${id}`);
}
export function previewTemplate(id: number, context: Record<string, string>): Promise<{ html: string }> {
  return api.post<{ html: string }>(`/documents/templates/${id}/preview`, { context });
}
export function generateDocument(id: number, input: { context: Record<string, string>; subjectType?: string | null; subjectId?: number | null; title?: string | null }): Promise<{ html: string; reference: string }> {
  return api.post<{ html: string; reference: string }>(`/documents/templates/${id}/generate`, input);
}
export function listGeneratedDocuments(): Promise<GeneratedDocument[]> {
  return api.get<GeneratedDocument[]>("/documents/history");
}
export function listDocumentVariables(): Promise<VariableGroup[]> {
  return api.get<VariableGroup[]>("/documents/variables");
}
/** Résout automatiquement les variables (école + élève réels) pour pré-remplir la génération. */
export function resolveDocumentContext(subjectType: string, subjectId: number): Promise<Record<string, string>> {
  return api.get<Record<string, string>>("/documents/context", { query: { subjectType, subjectId } });
}
