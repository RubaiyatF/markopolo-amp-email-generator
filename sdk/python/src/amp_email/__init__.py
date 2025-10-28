"""
AMP Email SDK for Python
Official Python client for the AMP Email Generation API
"""

from .client import AMPEmailClient
from .models import (
    Product,
    CampaignContext,
    UserContext,
    BrandContext,
    GenerationOptions,
    Template,
    Campaign,
)
from .exceptions import (
    AMPEmailError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
)

__version__ = "1.0.0"
__all__ = [
    "AMPEmailClient",
    "Product",
    "CampaignContext",
    "UserContext",
    "BrandContext",
    "GenerationOptions",
    "Template",
    "Campaign",
    "AMPEmailError",
    "AuthenticationError",
    "RateLimitError",
    "ValidationError",
]
