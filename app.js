import express from 'express';
import multer from 'multer';
import { existsSync, unlinkSync } from 'fs';
import { Writable } from 'stream';
import { spawn, execFile } from 'child_process';
import { path } from '@ffmpeg-installer/ffmpeg';
import corsPackage from 'cors';

// Create a writable stream that writes to the response
class ResponseStream extends Writable {
    // Constructor
    constructor(options, res) {
        super(options);
        this.res = res;
    }
    // Write to the response
    _write(chunk, encoding, callback) {
        this.res.write(chunk);
        callback();
    }
}

const app = express();
const cors = corsPackage();
const upload = multer({ dest: 'uploads/' });

// Enable CORS for all routes
app.use(cors);

// Speech to text endpoint
app.post('/speech-to-text', upload.single('mp3'), async (req, res) => {
    // Check if file was uploaded
    if (!req.file) {
        // No file was uploaded
        res.status(400).send('No file uploaded');
        // Return to prevent further execution
        return;
    }
    // Get the path to the WAV file
    const wavFilePath = `${req.file.path}.wav`;
    // Get the model and language
    const model = req.query.model || 'base.en';
    const language = req.query.lang || 'en';
    // Set the path to the Whisper ASR model
    const whisperDir = process.env.WHISPER_DIR || './whisper.cpp';
    // Process the audio file
    try {
        // Convert MP3 to WAV
        await new Promise((resolve, reject) => {
            // Convert the MP3 to WAV
            execFile(
                path,
                ['-i', req.file.path, '-ar', '16000', '-ac', '1', wavFilePath],
                (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
        // Transcribe audio using the Whisper ASR model
        const transcribe = spawn(`${whisperDir}/main`, [
            '-f',
            wavFilePath,
            '-l',
            language,
            '-m',
            `${whisperDir}/models/ggml-${model}.bin`,
        ], { shell: true });
        // Pipe the output to the response
        const responseStream = new ResponseStream({}, res);
        // Pipe the output to the response
        transcribe.stdout.on('data', (data) => {
            responseStream.write(data);
        });
        // Log any errors
        transcribe.stderr.on('data', (data) => {
            console.error(`Error: ${data}`);
        });
        // Close the response when the transcription is complete
        transcribe.on('close', (code) => {
            // Close the response
            responseStream.end();
            // Delete the WAV file
            if (existsSync(wavFilePath)) {
                unlinkSync(wavFilePath);
            }
            // Send the response
            res.status(200).end();
        });
    } catch (err) {
        // Log the error
        res.status(500).send('Error processing the audio file');
    } finally {
        // Delete the uploaded file
        unlinkSync(req.file.path);
    }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
