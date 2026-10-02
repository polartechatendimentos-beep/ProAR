"use client";

/* Public Blob URLs are selected at runtime and intentionally bypass Next image host configuration. */
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Package, Trash2, Upload, Wrench } from "lucide-react";

type CatalogModule = "Produtos" | "Serviços";

export function CatalogImageField({
  companyId,
  moduleName,
  value,
  onChange,
  onUploadingChange,
}: {
  companyId: string;
  moduleName: CatalogModule;
  value?: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    setPreviewError(false);
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
      setError("Use uma imagem JPG, PNG, WebP ou AVIF.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const form = new FormData();
      form.set("image", file);
      form.set("module", moduleName);
      form.set("companyId", companyId);
      const response = await fetch("/api/catalog/images", { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Falha ao enviar a imagem.");
      onChange(result.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = () => {
    if (!value) return;
    setError("");
    onChange("");
    setPreviewError(false);
  };

  return (
    <section className="catalog-image-field" aria-label={`Foto do ${moduleName === "Produtos" ? "produto" : "serviço"}`}>
      <div className="catalog-image-preview">
        {value && !previewError ? (
          <img src={value} alt={`Foto do item de ${moduleName.toLocaleLowerCase("pt-BR")}`} onError={() => setPreviewError(true)} />
        ) : (
          <div className="catalog-image-empty"><ImagePlus size={25} /><span>{value ? "Não foi possível carregar esta imagem" : "Nenhuma foto própria"}</span></div>
        )}
        {uploading && <div className="catalog-image-progress"><LoaderCircle size={19} className="catalog-image-spin" /> Enviando…</div>}
      </div>
      <div className="catalog-image-controls">
        <div><b>Foto própria do cadastro</b><small>JPG, PNG, WebP ou AVIF · até 5 MB</small></div>
        <div className="catalog-image-actions">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={event => void upload(event.target.files?.[0])} />
          <button type="button" className="outline-btn" disabled={uploading} onClick={() => inputRef.current?.click()}><Upload size={14} /> {value ? "Trocar foto" : "Enviar foto"}</button>
          {value && <button type="button" className="outline-btn catalog-image-remove" disabled={uploading} onClick={() => void remove()}><Trash2 size={14} /> Remover</button>}
        </div>
      </div>
      {error && <p className="catalog-image-error" role="alert">{error}</p>}
    </section>
  );
}

export function CatalogItemPhoto({ imageUrl, kind }: { imageUrl?: string; kind?: "Produto" | "Serviço" }) {
  const [failed, setFailed] = useState(false);
  return imageUrl && !failed ? (
    <img className="catalog-card-image" src={imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <span className={kind === "Serviço" ? "service" : "product"}>
      {kind === "Serviço" ? <Wrench size={17} /> : <Package size={17} />}
    </span>
  );
}
