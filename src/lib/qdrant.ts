import { QdrantClient } from '@qdrant/qdrant-js';

/**
 * Qdrant Vector Database Client
 * Handles vector storage and similarity search for email template inspiration
 *
 * Configuration required:
 * - QDRANT_URL: Qdrant cluster URL
 * - QDRANT_API_KEY: Qdrant API authentication key
 */

class QdrantService {
  private client: QdrantClient | null = null;
  private collectionName = 'flodesk_templates';
  private vectorSize = 768; // CLIP embedding dimension
  private initialized = false;

  constructor() {
    // Don't initialize in constructor - wait for first use
  }

  private isConfigured(): boolean {
    return !!(
      process.env.QDRANT_URL &&
      process.env.QDRANT_API_KEY
    );
  }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (!this.isConfigured()) {
      console.warn('⚠️  Qdrant not configured (missing QDRANT_URL or QDRANT_API_KEY)');
      return;
    }

    try {
      const qdrantUrl = process.env.QDRANT_URL!;

      this.client = new QdrantClient({
        url: qdrantUrl,
        apiKey: process.env.QDRANT_API_KEY!,
      });

      console.log('✅ Qdrant client initialized');
      console.log('   URL:', qdrantUrl);
      console.log('   Collection:', this.collectionName);
    } catch (error: any) {
      console.error('❌ Failed to initialize Qdrant client:', error.message);
      console.error('   Stack:', error.stack);
      this.client = null;
    }
  }

  /**
   * Check if Qdrant client is available
   */
  isAvailable(): boolean {
    this.ensureInitialized();

    const configured = this.isConfigured();
    const hasClient = this.client !== null;

    console.log(`[Qdrant] isAvailable check: configured=${configured}, hasClient=${hasClient}`);

    return configured && hasClient;
  }

  /**
   * Create the flodesk_templates collection if it doesn't exist
   */
  async ensureCollection(): Promise<void> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (exists) {
        console.log(`✅ Collection '${this.collectionName}' already exists`);
        return;
      }

      // Create collection
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: 'Cosine',
        },
      });

      console.log(`✅ Created collection '${this.collectionName}'`);
    } catch (error: any) {
      console.error('❌ Failed to ensure collection:', error.message);
      throw error;
    }
  }

  /**
   * Upsert a template with its vector embedding
   */
  async upsertTemplate(
    id: string | number,
    vector: number[],
    payload: {
      filename: string;
      r2_url: string;
      category?: string;
      design_analysis?: {
        colors?: string[];
        layout_type?: string;
        typography?: string;
        campaign_types?: string[];
        tone?: string;
        description?: string;
      };
    }
  ): Promise<void> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: id,
            vector: vector,
            payload: payload,
          },
        ],
      });

      console.log(`✅ Upserted template: ${payload.filename}`);
    } catch (error: any) {
      console.error(`❌ Failed to upsert template ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Search for similar templates using vector similarity
   */
  async searchSimilarTemplates(
    queryVector: number[],
    limit: number = 5,
    filter?: {
      campaign_type?: string;
      category?: string;
    }
  ): Promise<Array<{
    id: string | number;
    score: number;
    payload: any;
  }>> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      // Build filter if provided
      const qdrantFilter = filter ? this.buildFilter(filter) : undefined;

      const searchResult = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit: limit,
        filter: qdrantFilter,
        with_payload: true,
      });

      console.log(`🔍 Found ${searchResult.length} similar templates`);

      return searchResult.map((result) => ({
        id: result.id,
        score: result.score,
        payload: result.payload,
      }));
    } catch (error: any) {
      console.error('❌ Failed to search templates:', error.message);
      throw error;
    }
  }

  /**
   * Build Qdrant filter from search criteria
   */
  private buildFilter(filter: { campaign_type?: string; category?: string }): any {
    const conditions: any[] = [];

    if (filter.campaign_type) {
      conditions.push({
        key: 'design_analysis.campaign_types',
        match: {
          any: [filter.campaign_type],
        },
      });
    }

    if (filter.category) {
      conditions.push({
        key: 'category',
        match: {
          value: filter.category,
        },
      });
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<any | null> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      const points = await this.client.retrieve(this.collectionName, {
        ids: [id],
        with_payload: true,
        with_vector: false,
      });

      return points.length > 0 ? points[0].payload : null;
    } catch (error: any) {
      console.error(`❌ Failed to get template ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all templates (for debugging)
   */
  async getAllTemplates(limit: number = 100): Promise<any[]> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      const result = await this.client.scroll(this.collectionName, {
        limit: limit,
        with_payload: true,
        with_vector: false,
      });

      return result.points.map((point) => ({
        id: point.id,
        ...point.payload,
      }));
    } catch (error: any) {
      console.error('❌ Failed to get all templates:', error.message);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: [id],
      });

      console.log(`✅ Deleted template: ${id}`);
    } catch (error: any) {
      console.error(`❌ Failed to delete template ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<any> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      return await this.client.getCollection(this.collectionName);
    } catch (error: any) {
      console.error('❌ Failed to get collection info:', error.message);
      throw error;
    }
  }

  /**
   * Delete the entire collection (use with caution!)
   */
  async deleteCollection(): Promise<void> {
    if (!this.client) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      await this.client.deleteCollection(this.collectionName);
      console.log(`✅ Deleted collection: ${this.collectionName}`);
    } catch (error: any) {
      console.error('❌ Failed to delete collection:', error.message);
      throw error;
    }
  }

  /**
   * Get the Qdrant client instance (for advanced operations)
   */
  getClient(): QdrantClient | null {
    return this.client;
  }
}

export default new QdrantService();
