/// <reference path="site.js" />
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const originalCanvas = document.getElementById("originalCanvas");
const originalCtx = originalCanvas.getContext("2d");

let shapes = [];
let currentShapeIndex = 0;
let uploadedImage = null; // 🔁 Store image to redraw later

document.getElementById("imageInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    const imageURL = URL.createObjectURL(file);
    img.src = imageURL;

    img.onload = () => {
        uploadedImage = img;

        // Fit image into canvas with proper aspect ratio
        const { width: cw, height: ch } = originalCanvas;
        const iw = uploadedImage.width;
        const ih = uploadedImage.height;

        const scale = Math.min(cw / iw, ch / ih);
        const drawWidth = iw * scale;
        const drawHeight = ih * scale;
        const offsetX = (cw - drawWidth) / 2;
        const offsetY = (ch - drawHeight) / 2;

        uploadedImage._drawInfo = { scale, offsetX, offsetY };

        originalCtx.clearRect(0, 0, cw, ch);
        originalCtx.drawImage(uploadedImage, 0, 0, iw, ih, offsetX, offsetY, drawWidth, drawHeight);

        drawOriginalOutlines();
    };


    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/shape/detect", {
        method: "POST",
        body: formData
    });

    const result = await response.json();
    console.log("Shape Detection Response:", result);


    shapes = result.Shapes ?? result.shapes ?? [];

    if (Array.isArray(shapes)) {
        shapes.forEach(shape => {
            const pts = shape.points ?? shape.Points;
            shape.originalPoints = pts.map(p => [...p]); // deep copy
            shape.Points = pts.map(p => [...p]); // working copy
        });

        currentShapeIndex = 0;
        resetScaleAndDraw();
        drawOriginalOutlines();
        drawEditorCanvas();

    } else {
        console.warn("shapes is not defined or not an array:", shapes);
    }
});

function drawOriginalOutlines() {
    if (!uploadedImage || !uploadedImage._drawInfo) return;

    const { scale, offsetX, offsetY } = uploadedImage._drawInfo;
    const { width: cw, height: ch } = originalCanvas;

    originalCtx.clearRect(0, 0, cw, ch);
    originalCtx.drawImage(uploadedImage, 0, 0, uploadedImage.width, uploadedImage.height, offsetX, offsetY, uploadedImage.width * scale, uploadedImage.height * scale);

    for (const shape of shapes) {
        const pts = shape.Points;
        if (!Array.isArray(pts)) continue;

        originalCtx.beginPath();
        pts.forEach(([x, y], idx) => {
            const sx = x * scale + offsetX;
            const sy = y * scale + offsetY;
            if (idx === 0) originalCtx.moveTo(sx, sy);
            else originalCtx.lineTo(sx, sy);
        });
        originalCtx.closePath();
        originalCtx.strokeStyle = "rgba(0, 255, 0, 0.4)";
        originalCtx.lineWidth = 1;
        originalCtx.stroke();
    }
}



function drawEditorCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawInfo = canvas._drawInfo ?? { scale: 1, offsetX: 0, offsetY: 0 };
    const { scale, offsetX, offsetY } = drawInfo;

    shapes.forEach((shape, index) => {
        const pts = shape.Points;
        const name = shape.name ?? shape.Name;
        const cx = shape.centerX ?? shape.CenterX;
        const cy = shape.centerY ?? shape.CenterY;

        if (!Array.isArray(pts)) return;

        ctx.beginPath();
        pts.forEach(([x, y], idx) => {
            const sx = x * scale + offsetX;
            const sy = y * scale + offsetY;
            if (idx === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.closePath();

        ctx.strokeStyle = (index === currentShapeIndex) ? "red" : "green";
        ctx.lineWidth = (index === currentShapeIndex) ? 3 : 2;
        ctx.stroke();

        const scaledCx = cx * scale + offsetX;
        const scaledCy = cy * scale + offsetY;

        ctx.fillStyle = "black";
        ctx.font = "14px Arial";
        ctx.fillText(name, scaledCx, scaledCy);
    });
}


document.getElementById("btnPrev").addEventListener("click", () => {
    if (shapes.length === 0) return;
    currentShapeIndex = (currentShapeIndex - 1 + shapes.length) % shapes.length;
    resetScaleAndDraw();
});

document.getElementById("btnNext").addEventListener("click", () => {
    if (shapes.length === 0) return;
    currentShapeIndex = (currentShapeIndex + 1) % shapes.length;
    resetScaleAndDraw();
});

function resetScaleAndDraw() {
    const slider = document.getElementById("scaleSlider");
    slider.value = 100;
    document.getElementById("scaleValue").innerText = "1.00×";

    if (shapes.length === 0) return;

    const shape = shapes[currentShapeIndex];
    shape.Points = shape.originalPoints.map(p => [...p]);

    // Calculate scale to fit original image into right canvas
    const iw = uploadedImage?.width ?? 1;
    const ih = uploadedImage?.height ?? 1;
    const cw = canvas.width;
    const ch = canvas.height;

    const scale = Math.min(cw / iw, ch / ih);
    const offsetX = (cw - iw * scale) / 2;
    const offsetY = (ch - ih * scale) / 2;

    canvas._drawInfo = { scale, offsetX, offsetY };

    drawEditorCanvas();
}


document.getElementById("scaleSlider").addEventListener("input", (e) => {
    if (shapes.length === 0) return;

    const scale = parseInt(e.target.value) / 100;
    document.getElementById("scaleValue").innerText = scale.toFixed(2) + "×";

    const shape = shapes[currentShapeIndex];
    const cx = shape.centerX ?? shape.CenterX;
    const cy = shape.centerY ?? shape.CenterY;

    shape.Points = shape.originalPoints.map(([x, y]) => {
        return [
            Math.round(cx + (x - cx) * scale),
            Math.round(cy + (y - cy) * scale)
        ];
    });

    drawEditorCanvas();
});

    document.getElementById("btnDownload").addEventListener("click", () => {
    const canvas = document.getElementById("canvas");
    const link = document.createElement("a");
    link.download = "redrawn_image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
});
