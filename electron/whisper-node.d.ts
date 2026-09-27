declare module 'whisper-node' {
  export interface WhisperSegment {
    start: string
    end: string
    speech: string
  }

  export interface WhisperOptions {
    modelName?: string
    modelPath?: string
    whisperOptions?: {
      language?: string
      gen_file_txt?: boolean
      gen_file_subtitle?: boolean
      gen_file_vtt?: boolean
      word_timestamps?: boolean
      timestamp_size?: number
    }
    shellOptions?: Record<string, unknown>
  }

  // Resolves undefined when whisper.cpp fails (whisper-node logs and swallows the error)
  export function whisper(filePath: string, options?: WhisperOptions): Promise<WhisperSegment[] | undefined>
}
