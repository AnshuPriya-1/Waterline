/**
 * Client-Side Image Resizer
 * Shrinks photos to maximum dimension (1000px) and compresses to JPEG ~150-250KB.
 * Prevents mobile payload bloat and API Gateway 10MB timeouts.
 */
export function resizeImage(file, maxDimension = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided"));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image element"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Extract base64 without data:image/jpeg;base64, prefix
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Data = dataUrl.split(",")[1];
        resolve({
          base64: base64Data,
          previewUrl: dataUrl,
          width,
          height,
          approxSizeKb: Math.round((base64Data.length * 3) / 4 / 1024)
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
