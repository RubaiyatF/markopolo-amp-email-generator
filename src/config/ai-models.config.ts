/**
 * AI Models Configuration
 * Configure AI models for template generation, image, video, and GIF generation
 */

export interface AIModelConfig {
  // Template generation model (LLM)
  templateModel: {
    name: string;
    provider: string;
    modelId: string;
    version?: string;
    description: string;
    ragEnabled: boolean;
  };

  // Image generation/modification model
  imageModel: {
    name: string;
    provider: string;
    modelId: string;
    version?: string;
    description: string;
  };

  // Video/GIF generation model
  videoModel: {
    name: string;
    provider: string;
    modelId: string;
    version?: string;
    description: string;
    type: 'image-to-video';
  };

  // Default generation parameters
  defaults: {
    template: {
      temperature: number;
      maxTokens: number;
      topP: number;
    };
    image: {
      width: number;
      height: number;
      numOutputs: number;
      numInferenceSteps: number;
      guidanceScale: number;
    };
    video: {
      fps: number;
      duration: number;
      numInferenceSteps: number;
    };
  };
}

const aiModelConfig: AIModelConfig = {
  // Template Generation: DeepSeek R1 with Qdrant RAG
  templateModel: {
    name: 'DeepSeek R1',
    provider: 'replicate',
    modelId: 'deepseek-ai/deepseek-r1',
    description: 'Advanced reasoning model for intelligent template generation with RAG integration',
    ragEnabled: true
  },

  // Image Generation/Modification: Flux Dev
  imageModel: {
    name: 'Flux Dev',
    provider: 'replicate',
    modelId: 'black-forest-labs/flux-dev',
    description: 'Fast and efficient image generation/modification with excellent quality'
  },

  // Video Generation: Wan 2.1 I2V 480p
  videoModel: {
    name: 'Wan 2.1 I2V 480p',
    provider: 'replicate',
    modelId: 'wavespeedai/wan-2.1-i2v-480p',
    description: 'Image-to-video generation optimized for email-friendly 480p videos',
    type: 'image-to-video'
  },

  defaults: {
    template: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9
    },
    image: {
      width: 1024,
      height: 1024,
      numOutputs: 1,
      numInferenceSteps: 50,
      guidanceScale: 7.5
    },
    video: {
      fps: 24,
      duration: 3, // seconds
      numInferenceSteps: 30
    }
  }
};

export default aiModelConfig;
