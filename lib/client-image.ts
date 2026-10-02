export async function compressImageFile(file: File, options: { maxWidth?: number; maxHeight?: number; quality?: number; mimeType?: "image/jpeg" | "image/webp" } = {}) {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.72, mimeType = "image/jpeg" } = options;
  if (!file.type.startsWith("image/")) throw new Error("Arquivo selecionado não é uma imagem.");
  if (file.size > 20_000_000) throw new Error("Imagem muito grande. O limite para processamento é 20 MB.");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    element.src = source;
  });

  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Navegador sem suporte ao processamento de imagem.");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(mimeType, quality);
}
