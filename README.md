# Juandy Whisper

NodeJS API wrapping the whisper.cpp model to process and stream audio to text.

### Language
NodeJS

### Endpoints
POST /speech-to-text?model=base.en&lang=en body .mp3 file.

### Env
PORT=3000
WHISPER_DIR=./whisper.cpp