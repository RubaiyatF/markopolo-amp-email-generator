"""Exceptions for AMP Email SDK"""


class AMPEmailError(Exception):
    """Base exception for AMP Email SDK"""
    pass


class AuthenticationError(AMPEmailError):
    """Authentication failed"""
    pass


class RateLimitError(AMPEmailError):
    """Rate limit exceeded"""
    pass


class ValidationError(AMPEmailError):
    """Request validation failed"""
    pass
