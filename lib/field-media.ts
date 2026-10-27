export async function compressFieldPhoto(file:File,maxBytes=350000) {
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error("Use foto JPEG, PNG ou WebP.");
  const bitmap=await createImageBitmap(file);const canvas=document.createElement("canvas"),scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  for(const quality of [0.65,0.5,0.35]){const value=canvas.toDataURL("image/jpeg",quality);if(value.length<=maxBytes)return value;}
  throw new Error("Foto muito grande. Aproxime a câmera e tente novamente.");
}
