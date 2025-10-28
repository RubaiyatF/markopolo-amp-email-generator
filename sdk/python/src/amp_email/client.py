"""AMP Email API Client"""

import requests
from typing import List, Optional, Dict, Any
from .models import (
    Product,
    CampaignContext,
    UserContext,
    BrandContext,
    GenerationOptions,
    Campaign,
)
from .exceptions import AMPEmailError, AuthenticationError, RateLimitError


class AMPEmailClient:
    """Client for interacting with AMP Email Generation API"""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.amp-platform.com",
        timeout: int = 30,
    ):
        """
        Initialize AMP Email API client
        
        Args:
            api_key: Your API key from the dashboard
            base_url: API base URL (default: production)
            timeout: Request timeout in seconds
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "amp-email-python-sdk/1.0.0",
        })

    def generate(
        self,
        product_urls: Optional[List[str]] = None,
        products: Optional[List[Product]] = None,
        campaign_context: Optional[CampaignContext] = None,
        user_context: Optional[UserContext] = None,
        brand_context: Optional[BrandContext] = None,
        options: Optional[GenerationOptions] = None,
    ) -> Campaign:
        """
        Generate AMP email templates
        
        Args:
            product_urls: List of product URLs to extract
            products: List of product data objects
            campaign_context: Campaign configuration
            user_context: User personalization data
            brand_context: Brand styling and voice
            options: Generation options
            
        Returns:
            Campaign object with generated templates
        """
        if not product_urls and not products:
            raise ValueError("Either product_urls or products must be provided")

        payload = {
            "campaign_context": campaign_context.dict() if campaign_context else {},
        }

        if product_urls:
            payload["product_urls"] = product_urls
        if products:
            payload["products"] = [p.dict() for p in products]
        if user_context:
            payload["user_context"] = user_context.dict()
        if brand_context:
            payload["brand_context"] = brand_context.dict()
        if options:
            payload["options"] = options.dict()

        response = self._request("POST", "/api/v1/generate", json=payload)
        return Campaign(**response)

    def get_template(self, template_id: str) -> Dict[str, Any]:
        """Get template by ID"""
        return self._request("GET", f"/api/v1/templates/{template_id}")

    def personalize(
        self, template_id: str, recipient_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Personalize template with recipient data"""
        return self._request(
            "POST",
            "/api/v1/personalize",
            json={"template_id": template_id, "recipient_data": recipient_data},
        )

    def create_batch_campaign(
        self,
        campaign_name: str,
        product_urls: List[str],
        campaign_context: CampaignContext,
        max_concurrent: int = 10,
        chunk_size: int = 100,
        webhook_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create batch campaign for large-scale processing"""
        payload = {
            "campaign_name": campaign_name,
            "product_urls": product_urls,
            "campaign_context": campaign_context.dict(),
            "max_concurrent": max_concurrent,
            "chunk_size": chunk_size,
        }

        if webhook_url:
            payload["webhook_url"] = webhook_url

        return self._request("POST", "/api/v1/batch/campaign", json=payload)

    def get_campaign_analytics(self, campaign_id: str) -> Dict[str, Any]:
        """Get analytics for a campaign"""
        return self._request("GET", f"/api/v1/analytics/campaign/{campaign_id}")

    def _request(
        self, method: str, path: str, **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request to API"""
        url = f"{self.base_url}{path}"
        
        try:
            response = self.session.request(
                method, url, timeout=self.timeout, **kwargs
            )
            
            if response.status_code == 401:
                raise AuthenticationError("Invalid API key")
            elif response.status_code == 429:
                raise RateLimitError("Rate limit exceeded")
            elif response.status_code >= 400:
                error_data = response.json() if response.content else {}
                raise AMPEmailError(
                    error_data.get("message", f"API error: {response.status_code}")
                )
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise AMPEmailError(f"Request failed: {str(e)}")

    def close(self):
        """Close the session"""
        self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
