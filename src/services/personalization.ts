export class PersonalizationEngine {
  /**
   * Detect merge tags in content
   */
  detectMergeTags(content: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...content.matchAll(regex)];
    return [...new Set(matches.map(m => m[1].trim()))];
  }

  /**
   * Apply personalization to template
   */
  applyPersonalization(template: string, recipientData: Record<string, any>): string {
    let personalized = template;

    // Replace simple merge tags
    for (const [key, value] of Object.entries(recipientData)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      personalized = personalized.replace(regex, String(value));
    }

    // Handle defaults: {{field|default:"value"}}
    const defaultRegex = /\{\{([^}|]+)\|default:"([^"]+)"\}\}/g;
    personalized = personalized.replace(defaultRegex, (_match, field, defaultValue) => {
      return recipientData[field] || defaultValue;
    });

    // Handle nested fields: {{user.firstName}}
    const nestedRegex = /\{\{([^}]+\.[^}]+)\}\}/g;
    personalized = personalized.replace(nestedRegex, (match, path) => {
      const value = this.getNestedValue(recipientData, path);
      return value !== undefined ? String(value) : match;
    });

    return personalized;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Learn from historical performance (placeholder)
   */
  async learnFromHistory(_companyId: string, _userId: string, _performanceData: any): Promise<void> {
    console.log(`📊 Learning from performance data for ${_companyId}/${_userId}`);
    // Implementation would store patterns in personalization_history table
  }

  /**
   * Generate personalization recommendations
   */
  async generateRecommendations(_companyId: string, _userId: string): Promise<any> {
    return {
      recommendedMergeTags: ['firstName', 'email', 'lastPurchase'],
      suggestedTone: 'professional',
      optimizationTips: [
        'Include personalized product recommendations',
        'Use recipient first name in subject line',
        'Add urgency with limited-time offers'
      ]
    };
  }
}

export default new PersonalizationEngine();
