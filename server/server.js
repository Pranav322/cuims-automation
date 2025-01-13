const express = require('express');
const cors = require('cors');
const { createWorker } = require('tesseract.js');
const app = express();

app.use(cors());
app.use(express.json({limit: '50mb'}));

app.post('/process_captcha', async (req, res) => {
    try {
        console.log('Received captcha image data:', req.body.image);

        const imageData = req.body.image;
        const worker = await createWorker();
        
        await worker.loadLanguage('eng');
        await worker.initialize('eng', { 
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' 
        });
        const { data: { text } } = await worker.recognize(imageData);
        await worker.terminate();

        // Clean and format the text
        const cleanText = text.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4); // Adjust as needed
        console.log('Processed captcha text:', cleanText);
        res.json({ captcha: cleanText });
    } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 