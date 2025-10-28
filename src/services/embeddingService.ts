import OpenAI from 'openai';
import { CampaignContext } from '../schemas';

/**
 * Embedding Service
 * Generates vector embeddings for text and images using OpenAI
 *
 * For images: Uses OpenAI's vision capabilities combined with text embeddings
 * For text: Uses text-embedding-3-small model
 *
 * Configuration required:
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_EMBEDDING_MODEL: Embedding model to use (default: text-embedding-3-small)
 */

class EmbeddingService {
  private client: OpenAI | null = null;
  private embeddingModel: string;
  private readonly EMBEDDING_DIMENSION = 768; // Reduced dimension for efficiency
  private initialized = false;

  constructor() {
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  private isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (!this.isConfigured()) {
      console.warn('⚠️  OpenAI not configured (missing OPENAI_API_KEY)');
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      });

      console.log('✅ OpenAI client initialized for embeddings');
      console.log('   Model:', this.embeddingModel);
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI client:', error);
      this.client = null;
    }
  }

  /**
   * Check if embedding service is available
   */
  isAvailable(): boolean {
    this.ensureInitialized();
    return this.isConfigured() && this.client !== null;
  }

  /**
   * Generate text embedding
   */
  async generateTextEmbedding(text: string): Promise<number[]> {
    this.ensureInitialized();

    if (!this.client) {
      console.warn('OpenAI client not configured. Returning mock embedding.');
      return this.generateMockEmbedding();
    }

    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
        dimensions: this.EMBEDDING_DIMENSION,
      });

      return response.data[0].embedding;
    } catch (error: any) {
      console.error('❌ Failed to generate text embedding:', error.message);
      throw error;
    }
  }

  /**
   * Generate embedding from image description
   * Since we can't directly embed images, we use the vision model's description
   * and create an embedding from that description
   */
  async generateImageEmbedding(imageDescription: string): Promise<number[]> {
    // For image templates, we create a rich description embedding
    // that captures the visual elements
    const enrichedDescription = `Email template design: ${imageDescription}`;
    return this.generateTextEmbedding(enrichedDescription);
  }

  /**
   * Generate campaign context embedding for similarity search
   */
  async generateCampaignEmbedding(campaignContext: CampaignContext): Promise<number[]> {
    const campaignDescription = this.buildCampaignDescription(campaignContext);
    return this.generateTextEmbedding(campaignDescription);
  }

  /**
   * Build a rich textual description of the campaign for embedding
   */
  private buildCampaignDescription(context: CampaignContext): string {
    const parts: string[] = [];

    // Campaign type
    parts.push(`Campaign type: ${context.type}`);

    // Goal
    parts.push(`Goal: ${context.goal}`);

    // Urgency
    if (context.urgency) {
      parts.push(`Urgency level: ${context.urgency}`);
    }

    // Discount
    if (context.discount) {
      parts.push(`Discount offer: ${context.discount}%`);
    }

    // Tone descriptors based on campaign type
    const toneMap: Record<string, string> = {
      abandoned_cart: 'friendly reminder, gentle persuasion, recover lost sale',
      product_launch: 'exciting announcement, new arrival, exclusive first look',
      price_drop: 'special deal, limited time offer, save money',
      promotional: 'marketing campaign, special promotion, call to action',
      newsletter: 'informative, engaging content, regular update',
      transactional: 'order confirmation, shipping update, professional',
    };

    if (toneMap[context.type]) {
      parts.push(`Tone: ${toneMap[context.type]}`);
    }

    // Design requirements based on urgency
    if (context.urgency === 'high') {
      parts.push('Design: bold colors, urgent messaging, time-sensitive elements');
    } else if (context.urgency === 'low') {
      parts.push('Design: calm colors, relaxed messaging, informative');
    } else {
      parts.push('Design: balanced approach, clear call to action');
    }

    return parts.join('. ');
  }

  /**
   * Generate batch embeddings for multiple texts
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      console.warn('OpenAI client not configured. Returning mock embeddings.');
      return texts.map(() => this.generateMockEmbedding());
    }

    try {
      // OpenAI supports batch embeddings
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: texts,
        dimensions: this.EMBEDDING_DIMENSION,
      });

      return response.data.map((item) => item.embedding);
    } catch (error: any) {
      console.error('❌ Failed to generate batch embeddings:', error.message);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Generate mock embedding for development/testing
   */
  private generateMockEmbedding(): number[] {
    // Generate a random normalized vector
    const embedding = Array.from({ length: this.EMBEDDING_DIMENSION }, () =>
      Math.random() - 0.5
    );

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / norm);
  }

  /**
   * Combine multiple embeddings with weights
   */
  combineEmbeddings(embeddings: number[][], weights?: number[]): number[] {
    if (embeddings.length === 0) {
      throw new Error('At least one embedding is required');
    }

    const dimension = embeddings[0].length;
    const actualWeights = weights || embeddings.map(() => 1 / embeddings.length);

    if (actualWeights.length !== embeddings.length) {
      throw new Error('Weights must match number of embeddings');
    }

    const combined = new Array(dimension).fill(0);

    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      const weight = actualWeights[i];

      for (let j = 0; j < dimension; j++) {
        combined[j] += embedding[j] * weight;
      }
    }

    // Normalize the combined embedding
    const norm = Math.sqrt(combined.reduce((sum, val) => sum + val * val, 0));
    return combined.map((val) => val / norm);
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDimension(): number {
    return this.EMBEDDING_DIMENSION;
  }
}

export default new EmbeddingService();
