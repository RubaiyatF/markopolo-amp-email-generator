import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Client - Alternative to Prisma when direct DB connection fails
 * Uses Supabase REST API which works even when connection pooling is blocked
 */

class SupabaseService {
  private client: SupabaseClient | null = null;
  private initialized = false;

  private isConfigured(): boolean {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (!this.isConfigured()) {
      console.warn('⚠️  Supabase not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
      return;
    }

    try {
      this.client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      console.log('✅ Supabase client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
      this.client = null;
    }
  }

  isAvailable(): boolean {
    this.ensureInitialized();
    return this.isConfigured() && this.client !== null;
  }

  getClient(): SupabaseClient {
    this.ensureInitialized();
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return this.client;
  }

  /**
   * Find company by API key using Supabase REST API
   */
  async findCompanyByApiKey(apiKey: string): Promise<any | null> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await this.client
      .from('companies')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Create a new campaign
   */
  async createCampaign(campaignData: any): Promise<any> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await this.client
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create templates (batch insert)
   */
  async createTemplates(templates: any[]): Promise<any[]> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await this.client
      .from('templates')
      .insert(templates)
      .select();

    if (error) throw error;
    return data || [];
  }

  /**
   * Update campaign with metadata (for RAG tracking)
   */
  async updateCampaignMetadata(campaignId: string, metadata: any): Promise<void> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { error } = await this.client
      .from('campaigns')
      .update({ metadata })
      .eq('id', campaignId);

    if (error) throw error;
  }

  /**
   * Create generation log
   */
  async createGenerationLog(logData: any): Promise<any> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await this.client
      .from('generation_logs')
      .insert(logData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create analytics event
   */
  async createAnalytics(analyticsData: any): Promise<any> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await this.client
      .from('analytics')
      .insert(analyticsData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Find template by ID
   */
  async findTemplateById(id: string): Promise<any | null> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await this.client
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Find campaign by internal ID
   */
  async findCampaignByInternalId(internalId: string): Promise<any | null> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { data, error } = await this.client
      .from('campaigns')
      .select('*')
      .eq('internal_id', internalId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Update campaign
   */
  async updateCampaign(campaignId: string, updates: any): Promise<void> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { error } = await this.client
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId);

    if (error) throw error;
  }

  /**
   * Update company credits
   */
  async updateCompanyCredits(companyId: string, creditsRemaining: number): Promise<void> {
    this.ensureInitialized();

    if (!this.client) {
      throw new Error('Supabase client not available');
    }

    const { error } = await this.client
      .from('companies')
      .update({ credits_remaining: creditsRemaining })
      .eq('company_id', companyId);

    if (error) throw error;
  }
}

export default new SupabaseService();
