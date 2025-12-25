// Wait for the HTML to be loaded
document.addEventListener('DOMContentLoaded', () => {

    // --- Get All HTML Elements ---
    const canvas = document.getElementById('sketch-canvas');
    const ctx = canvas.getContext('2d');
    const clearCanvasButton = document.getElementById('clear-canvas');
    const brushSizeSlider = document.getElementById('brush-size');
    
    const textPrompt = document.getElementById('text-prompt');
    const generateButton = document.getElementById('generate-button');
    const outputImage = document.getElementById('output-image');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');

    let isDrawing = false;


    // --- Canvas Setup ---
    function setCanvasSize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "black";
        ctx.lineWidth = brushSizeSlider.value;
        ctx.lineCap = "round";
    }

    function getEventPosition(e) {
        const rect = canvas.getBoundingClientRect();
        let x, y;
        if (e.touches) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }
        return { x, y };
    }

    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        const { x, y } = getEventPosition(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getEventPosition(e);
        ctx.lineWidth = brushSizeSlider.value;
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }

    function clearCanvas() {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- Connect Functions to Events ---
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    clearCanvasButton.addEventListener('click', clearCanvas);

    // --- Main "Generate" Button Logic ---
    generateButton.addEventListener('click', async () => {
        // 1. Show loader, hide errors
        loader.classList.remove('hidden');
        generateButton.disabled = true;
        generateButton.textContent = 'Generating...';
        errorMessage.classList.add('hidden');

        try {
            // 2. Get canvas image as a base64 string
            const imageDataUrl = canvas.toDataURL('image/png');
            
            // 3. Get prompt text
            const prompt = textPrompt.value;

            // 4. Send to backend /api/generate

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    image_data: imageDataUrl,
                }),
            });

            const result = await response.json();

            
            // 5. Handle response
            if (!response.ok) {
                throw new Error(result.error || 'Unknown error');
            }

            // 6. Success: Show new image
            outputImage.src = result.image_url;

        } catch (error) {
            // 7. Failure: Show error message
            console.error('Error:', error);
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
            outputImage.src = 'https://placehold.co/512x512/ff6b6b/ffffff?text=Generation+Failed';
        } finally {
            // 8. Always hide loader
            loader.classList.add('hidden');
            generateButton.disabled = false;
            generateButton.textContent = 'Generate Image';
        }
    });
});