"""Data models for AMP Email SDK"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class CampaignType(str, Enum):
    ABANDONED_CART = "abandoned_cart"
    PROMOTIONAL = "promotional"
    PRODUCT_LAUNCH = "product_launch"
    PRICE_DROP = "price_drop"
    BACK_IN_STOCK = "back_in_stock"


class CampaignGoal(str, Enum):
    ACQUISITION = "acquisition"
    RETENTION = "retention"
    ENGAGEMENT = "engagement"
    CONVERSION = "conversion"


class Urgency(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Product(BaseModel):
    """Product data model"""
    id: Optional[str] = None
    name: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = "USD"
    image: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None


class CampaignContext(BaseModel):
    """Campaign configuration"""
    type: CampaignType
    goal: CampaignGoal
    urgency: Optional[Urgency] = None
    discount: Optional[float] = None


class UserContext(BaseModel):
    """User personalization data"""
    first_name: Optional[str] = Field(None, alias="firstName")
    last_name: Optional[str] = Field(None, alias="lastName")
    email: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = Field(None, alias="customFields")


class BrandContext(BaseModel):
    """Brand styling and voice"""
    voice: Optional[str] = None
    colors: Optional[List[str]] = None
    logo: Optional[str] = None
    company_name: Optional[str] = Field(None, alias="companyName")


class GenerationOptions(BaseModel):
    """Template generation options"""
    variations: int = 3
    preserve_merge_tags: bool = Field(True, alias="preserveMergeTags")


class Template(BaseModel):
    """Generated template"""
    id: str
    variation_name: str = Field(..., alias="variationName")
    amp_url: str = Field(..., alias="ampUrl")
    fallback_url: str = Field(..., alias="fallbackUrl")
    content: Dict[str, Any]
    merge_tags: List[str] = Field(..., alias="mergeTags")


class Campaign(BaseModel):
    """Campaign with generated templates"""
    campaign_id: str = Field(..., alias="campaignId")
    templates: List[Template]
    preview_urls: List[Dict[str, str]] = Field(..., alias="previewUrls")
    cost: Dict[str, Any]
    metadata: Dict[str, Any]
