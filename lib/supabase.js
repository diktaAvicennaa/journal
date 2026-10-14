const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;


const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

export async function getTrades() {
  const res = await fetch(`${URL}/rest/v1/trades?select=*&order=created_at.desc`, {
    headers,
    cache: "no-store",
  });
  const data = await res.json();
  console.log("Response Supabase:", data);
  return Array.isArray(data) ? data : [];
}

export async function addTrade(trade) {
  const res = await fetch(`${URL}/rest/v1/trades`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(trade),
  });
  return res.json();
}

export async function deleteTrade(id) {
  await fetch(`${URL}/rest/v1/trades?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
}
export async function updateTrade(id, trade) {
  const res = await fetch(`${URL}/rest/v1/trades?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(trade),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("UPDATE TRADE ERROR:", data);
    throw new Error(data.message || "Gagal update trade");
  }
  return data;
}
export async function uploadImage(file) {
  const filename = `${Date.now()}-${file.name}`;
  const res = await fetch(`${URL}/storage/v1/object/images/${filename}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!res.ok) throw new Error("Upload gagal");
  return `${URL}/storage/v1/object/public/images/${filename}`;
}
// Compress image pakai Canvas (tanpa library)
export async function compressImage(file, maxWidth = 1400, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      let { width, height } = img;

      // Resize kalau lebih besar dari maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          // Bikin File baru dengan nama asli
          const compressed = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
            type: "image/jpeg",
          });
          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };

    reader.readAsDataURL(file);
  });
}