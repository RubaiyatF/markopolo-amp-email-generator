/**
 * Feature Flags Configuration
 * Controls gradual rollout of interactive shopping experience features
 */

export interface FeatureFlags {
  enableInteractiveTemplates: boolean;
  enableImageEnhancement: boolean;
  enableBrandAnalysis: boolean;
  enableAgentGeneration: boolean;
  enableCartHandoff: boolean;
}

export interface ImageEnhancementConfig {
  backgroundRemovalEnabled: boolean;
  backgroundRegenerationEnabled: boolean;
  imageLabelingEnabled: boolean;
  defaultBackgroundStyle: 'professional' | 'lifestyle' | 'seasonal' | 'luxury';
  minImageWidth: number;
  maxImagesPerProduct: number;
}

export interface BrandAnalysisConfig {
  depth: 'shallow' | 'standard' | 'deep';
  cacheTTLHours: number;
  productCacheTTLHours: number;
}

export interface CartHandoffConfig {
  urlShortenerEnabled: boolean;
  urlShortenerTTLHours: number;
  sessionStorageTTLHours: number;
  maxUrlLength: number;
}

export interface AgentConfig {
  version: string;
  maxRetries: number;
  timeoutMs: number;
}

export interface PerformanceConfig {
  parallelImageProcessing: boolean;
  maxParallelImages: number;
  backgroundJobEnabled: boolean;
}

export interface MonitoringConfig {
  enablePerformanceTiming: boolean;
  enableCostTracking: boolean;
  enableAnalyticsTracking: boolean;
  correlationIdHeader: string;
}

class FeatureFlagService {
  private static instance: FeatureFlagService;

  private constructor() {}

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Get feature flags configuration
   */
  public getFeatureFlags(): FeatureFlags {
    return {
      enableInteractiveTemplates: this.parseBool(process.env.ENABLE_INTERACTIVE_TEMPLATES, false),
      enableImageEnhancement: this.parseBool(process.env.ENABLE_IMAGE_ENHANCEMENT, false),
      enableBrandAnalysis: this.parseBool(process.env.ENABLE_BRAND_ANALYSIS, true),
      enableAgentGeneration: this.parseBool(process.env.ENABLE_AGENT_GENERATION, false),
      enableCartHandoff: this.parseBool(process.env.ENABLE_CART_HANDOFF, false),
    };
  }

  /**
   * Get image enhancement configuration
   */
  public getImageEnhancementConfig(): ImageEnhancementConfig {
    return {
      backgroundRemovalEnabled: this.parseBool(process.env.BACKGROUND_REMOVAL_ENABLED, true),
      backgroundRegenerationEnabled: this.parseBool(process.env.BACKGROUND_REGENERATION_ENABLED, true),
      imageLabelingEnabled: this.parseBool(process.env.IMAGE_LABELING_ENABLED, true),
      defaultBackgroundStyle: (process.env.DEFAULT_BACKGROUND_STYLE as any) || 'professional',
      minImageWidth: parseInt(process.env.MIN_IMAGE_WIDTH || '800', 10),
      maxImagesPerProduct: parseInt(process.env.MAX_IMAGES_PER_PRODUCT || '10', 10),
    };
  }

  /**
   * Get brand analysis configuration
   */
  public getBrandAnalysisConfig(): BrandAnalysisConfig {
    return {
      depth: (process.env.BRAND_ANALYSIS_DEPTH as any) || 'standard',
      cacheTTLHours: parseInt(process.env.BRAND_CACHE_TTL_HOURS || '168', 10), // 7 days
      productCacheTTLHours: parseInt(process.env.PRODUCT_CACHE_TTL_HOURS || '24', 10), // 24 hours
    };
  }

  /**
   * Get cart handoff configuration
   */
  public getCartHandoffConfig(): CartHandoffConfig {
    return {
      urlShortenerEnabled: this.parseBool(process.env.URL_SHORTENER_ENABLED, true),
      urlShortenerTTLHours: parseInt(process.env.URL_SHORTENER_TTL_HOURS || '24', 10),
      sessionStorageTTLHours: parseInt(process.env.SESSION_STORAGE_TTL_HOURS || '1', 10),
      maxUrlLength: parseInt(process.env.MAX_URL_LENGTH || '1800', 10),
    };
  }

  /**
   * Get agent system configuration
   */
  public getAgentConfig(): AgentConfig {
    return {
      version: process.env.AGENT_ORCHESTRATOR_VERSION || '1.0.0',
      maxRetries: parseInt(process.env.AGENT_MAX_RETRIES || '3', 10),
      timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '30000', 10),
    };
  }

  /**
   * Get performance configuration
   */
  public getPerformanceConfig(): PerformanceConfig {
    return {
      parallelImageProcessing: this.parseBool(process.env.PARALLEL_IMAGE_PROCESSING, true),
      maxParallelImages: parseInt(process.env.MAX_PARALLEL_IMAGES || '5', 10),
      backgroundJobEnabled: this.parseBool(process.env.BACKGROUND_JOB_ENABLED, true),
    };
  }

  /**
   * Get monitoring configuration
   */
  public getMonitoringConfig(): MonitoringConfig {
    return {
      enablePerformanceTiming: this.parseBool(process.env.ENABLE_PERFORMANCE_TIMING, true),
      enableCostTracking: this.parseBool(process.env.ENABLE_COST_TRACKING, true),
      enableAnalyticsTracking: this.parseBool(process.env.ENABLE_ANALYTICS_TRACKING, true),
      correlationIdHeader: process.env.CORRELATION_ID_HEADER || 'X-Correlation-ID',
    };
  }

  /**
   * Check if a specific feature is enabled
   */
  public isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    const flags = this.getFeatureFlags();
    return flags[feature];
  }

  /**
   * Get all configuration
   */
  public getAllConfig() {
    return {
      featureFlags: this.getFeatureFlags(),
      imageEnhancement: this.getImageEnhancementConfig(),
      brandAnalysis: this.getBrandAnalysisConfig(),
      cartHandoff: this.getCartHandoffConfig(),
      agent: this.getAgentConfig(),
      performance: this.getPerformanceConfig(),
      monitoring: this.getMonitoringConfig(),
    };
  }

  /**
   * Helper method to parse boolean environment variables
   */
  private parseBool(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
  }
}

export const featureFlagService = FeatureFlagService.getInstance();
export default featureFlagService;
