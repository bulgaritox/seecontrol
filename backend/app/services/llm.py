"""
LLM Service
Multi-provider LLM service with automatic failover
"""

from typing import Optional, Dict, Any, List, Tuple
from enum import Enum
import httpx
import json
import logging
from datetime import datetime
import asyncio

from ..config.llm import llm_config, LLMConfig, ProviderType, enabled_providers
from ..config.settings import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Custom exception for LLM errors"""
    def __init__(self, message: str, provider: str = None, retryable: bool = False):
        self.message = message
        self.provider = provider
        self.retryable = retryable
        super().__init__(message)


class LLMService:
    """Service for interacting with LLM providers"""
    
    def __init__(self):
        self.clients: Dict[ProviderType, httpx.AsyncClient] = {}
        self.initialized = False
        self.current_provider: Optional[ProviderType] = None
    
    async def initialize(self):
        """Initialize LLM service"""
        if self.initialized:
            return
        
        # Create HTTP clients for each enabled provider
        for provider in enabled_providers:
            config = llm_config.providers.get(provider)
            if config:
                self.clients[provider] = httpx.AsyncClient(
                    base_url=str(config.api_url),
                    timeout=config.timeout,
                    headers=self._get_headers(provider),
                )
        
        # Set current provider
        self.current_provider = llm_config.default_provider
        self.initialized = True
        
        logger.info(f"LLM service initialized with providers: {[p.value for p in enabled_providers]}")
    
    def _get_headers(self, provider: ProviderType) -> Dict[str, str]:
        """Get headers for a provider"""
        config = llm_config.providers.get(provider)
        headers = {
            "Content-Type": "application/json",
        }
        
        if config and config.api_key:
            if provider == ProviderType.ANTHROPIC:
                headers["x-api-key"] = config.api_key
                headers["anthropic-version"] = "2023-06-01"
            elif provider == ProviderType.OPENAI:
                headers["Authorization"] = f"Bearer {config.api_key}"
            elif provider == ProviderType.DEEPSEEK:
                headers["Authorization"] = f"Bearer {config.api_key}"
            elif provider == ProviderType.MISTRAL:
                headers["Authorization"] = f"Bearer {config.api_key}"
            elif provider == ProviderType.GROQ:
                headers["Authorization"] = f"Bearer {config.api_key}"
            elif provider == ProviderType.CUSTOM:
                headers["Authorization"] = f"Bearer {config.api_key}"
        
        return headers
    
    async def close(self):
        """Close all HTTP clients"""
        for client in self.clients.values():
            await client.aclose()
        self.clients.clear()
        self.initialized = False
    
    async def _call_anthropic(self, prompt: str, model: str, messages: List[Dict], **kwargs) -> Tuple[str, int]:
        """Call Anthropic API"""
        config = llm_config.providers.get(ProviderType.ANTHROPIC)
        if not config or not config.api_key:
            raise LLMError("Anthropic not configured", ProviderType.ANTHROPIC)
        
        client = self.clients.get(ProviderType.ANTHROPIC)
        if not client:
            raise LLMError("Anthropic client not initialized", ProviderType.ANTHROPIC)
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7),
            **kwargs,
        }
        
        try:
            response = await client.post("/v1/messages", json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract content
            if data.get("content") and isinstance(data["content"], list):
                content = "".join([block.get("text", "") for block in data["content"] if block.get("type") == "text"])
            else:
                content = str(data.get("content", ""))
            
            # Count tokens
            input_tokens = data.get("usage", {}).get("input_tokens", 0)
            output_tokens = data.get("usage", {}).get("output_tokens", 0)
            total_tokens = input_tokens + output_tokens
            
            return content, total_tokens
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise LLMError("Rate limit exceeded", ProviderType.ANTHROPIC, retryable=True)
            raise LLMError(f"Anthropic error: {e}", ProviderType.ANTHROPIC)
        except Exception as e:
            raise LLMError(f"Anthropic error: {e}", ProviderType.ANTHROPIC)
    
    async def _call_openai(self, prompt: str, model: str, messages: List[Dict], **kwargs) -> Tuple[str, int]:
        """Call OpenAI API"""
        config = llm_config.providers.get(ProviderType.OPENAI)
        if not config or not config.api_key:
            raise LLMError("OpenAI not configured", ProviderType.OPENAI)
        
        client = self.clients.get(ProviderType.OPENAI)
        if not client:
            raise LLMError("OpenAI client not initialized", ProviderType.OPENAI)
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7),
            **kwargs,
        }
        
        try:
            response = await client.post("/v1/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract content
            if data.get("choices") and len(data["choices"]) > 0:
                content = data["choices"][0].get("message", {}).get("content", "")
            else:
                content = ""
            
            # Count tokens
            usage = data.get("usage", {})
            total_tokens = usage.get("total_tokens", usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0))
            
            return content, total_tokens
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise LLMError("Rate limit exceeded", ProviderType.OPENAI, retryable=True)
            raise LLMError(f"OpenAI error: {e}", ProviderType.OPENAI)
        except Exception as e:
            raise LLMError(f"OpenAI error: {e}", ProviderType.OPENAI)
    
    async def _call_deepseek(self, prompt: str, model: str, messages: List[Dict], **kwargs) -> Tuple[str, int]:
        """Call DeepSeek API"""
        config = llm_config.providers.get(ProviderType.DEEPSEEK)
        if not config or not config.api_key:
            raise LLMError("DeepSeek not configured", ProviderType.DEEPSEEK)
        
        client = self.clients.get(ProviderType.DEEPSEEK)
        if not client:
            raise LLMError("DeepSeek client not initialized", ProviderType.DEEPSEEK)
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7),
            **kwargs,
        }
        
        try:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract content
            if data.get("choices") and len(data["choices"]) > 0:
                content = data["choices"][0].get("message", {}).get("content", "")
            else:
                content = ""
            
            # Count tokens (DeepSeek may not return usage)
            total_tokens = 0
            
            return content, total_tokens
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise LLMError("Rate limit exceeded", ProviderType.DEEPSEEK, retryable=True)
            raise LLMError(f"DeepSeek error: {e}", ProviderType.DEEPSEEK)
        except Exception as e:
            raise LLMError(f"DeepSeek error: {e}", ProviderType.DEEPSEEK)
    
    async def _call_mistral(self, prompt: str, model: str, messages: List[Dict], **kwargs) -> Tuple[str, int]:
        """Call Mistral API"""
        config = llm_config.providers.get(ProviderType.MISTRAL)
        if not config or not config.api_key:
            raise LLMError("Mistral not configured", ProviderType.MISTRAL)
        
        client = self.clients.get(ProviderType.MISTRAL)
        if not client:
            raise LLMError("Mistral client not initialized", ProviderType.MISTRAL)
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7),
            **kwargs,
        }
        
        try:
            response = await client.post("/v1/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract content
            if data.get("choices") and len(data["choices"]) > 0:
                content = data["choices"][0].get("message", {}).get("content", "")
            else:
                content = ""
            
            # Count tokens
            usage = data.get("usage", {})
            total_tokens = usage.get("total_tokens", usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0))
            
            return content, total_tokens
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise LLMError("Rate limit exceeded", ProviderType.MISTRAL, retryable=True)
            raise LLMError(f"Mistral error: {e}", ProviderType.MISTRAL)
        except Exception as e:
            raise LLMError(f"Mistral error: {e}", ProviderType.MISTRAL)
    
    async def _call_groq(self, prompt: str, model: str, messages: List[Dict], **kwargs) -> Tuple[str, int]:
        """Call Groq API"""
        config = llm_config.providers.get(ProviderType.GROQ)
        if not config or not config.api_key:
            raise LLMError("Groq not configured", ProviderType.GROQ)
        
        client = self.clients.get(ProviderType.GROQ)
        if not client:
            raise LLMError("Groq client not initialized", ProviderType.GROQ)
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7),
            **kwargs,
        }
        
        try:
            response = await client.post("/v1/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract content
            if data.get("choices") and len(data["choices"]) > 0:
                content = data["choices"][0].get("message", {}).get("content", "")
            else:
                content = ""
            
            # Count tokens
            usage = data.get("usage", {})
            total_tokens = usage.get("total_tokens", usage.get("prompt_tokens", 0) + usage.get("completion_tokens", 0))
            
            return content, total_tokens
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise LLMError("Rate limit exceeded", ProviderType.GROQ, retryable=True)
            raise LLMError(f"Groq error: {e}", ProviderType.GROQ)
        except Exception as e:
            raise LLMError(f"Groq error: {e}", ProviderType.GROQ)
    
    async def _call_custom(self, prompt: str, model: str, messages: List[Dict], **kwargs) -> Tuple[str, int]:
        """Call custom endpoint"""
        config = llm_config.providers.get(ProviderType.CUSTOM)
        if not config or not config.api_url:
            raise LLMError("Custom endpoint not configured", ProviderType.CUSTOM)
        
        client = self.clients.get(ProviderType.CUSTOM)
        if not client:
            raise LLMError("Custom client not initialized", ProviderType.CUSTOM)
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7),
            **kwargs,
        }
        
        try:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract content (custom format may vary)
            content = str(data)
            total_tokens = 0
            
            return content, total_tokens
            
        except Exception as e:
            raise LLMError(f"Custom endpoint error: {e}", ProviderType.CUSTOM)
    
    async def chat(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        provider: Optional[ProviderType] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        **kwargs
    ) -> Tuple[str, int, str]:
        """
        Send a chat completion request with automatic failover
        Returns: (content, tokens_used, provider_used)
        """
        if not self.initialized:
            await self.initialize()
        
        # Use specified provider or default
        if provider:
            providers_to_try = [provider]
        else:
            providers_to_try = enabled_providers
        
        last_error = None
        
        for provider_type in providers_to_try:
            try:
                # Select model
                if not model:
                    config = llm_config.providers.get(provider_type)
                    if config and config.models:
                        model = config.models[0]
                    else:
                        model = "gpt-3.5-turbo"
                
                # Call the appropriate provider
                if provider_type == ProviderType.ANTHROPIC:
                    content, tokens = await self._call_anthropic("", model, messages, max_tokens=max_tokens, temperature=temperature, **kwargs)
                elif provider_type == ProviderType.OPENAI:
                    content, tokens = await self._call_openai("", model, messages, max_tokens=max_tokens, temperature=temperature, **kwargs)
                elif provider_type == ProviderType.DEEPSEEK:
                    content, tokens = await self._call_deepseek("", model, messages, max_tokens=max_tokens, temperature=temperature, **kwargs)
                elif provider_type == ProviderType.MISTRAL:
                    content, tokens = await self._call_mistral("", model, messages, max_tokens=max_tokens, temperature=temperature, **kwargs)
                elif provider_type == ProviderType.GROQ:
                    content, tokens = await self._call_groq("", model, messages, max_tokens=max_tokens, temperature=temperature, **kwargs)
                elif provider_type == ProviderType.CUSTOM:
                    content, tokens = await self._call_custom("", model, messages, max_tokens=max_tokens, temperature=temperature, **kwargs)
                else:
                    raise LLMError(f"Unknown provider: {provider_type}", provider_type)
                
                logger.info(f"LLM call successful: {provider_type.value}, tokens: {tokens}")
                return content, tokens, provider_type.value
                
            except LLMError as e:
                last_error = e
                logger.warning(f"LLM error with {provider_type.value}: {e.message}")
                if not e.retryable:
                    break
                continue
        
        # All providers failed
        raise LLMError(
            f"All LLM providers failed: {last_error.message if last_error else 'Unknown error'}",
            provider_type.value if last_error else None
        )
    
    async def complete(
        self,
        prompt: str,
        model: Optional[str] = None,
        provider: Optional[ProviderType] = None,
        **kwargs
    ) -> Tuple[str, int, str]:
        """
        Send a text completion request
        Returns: (content, tokens_used, provider_used)
        """
        messages = [{"role": "user", "content": prompt}]
        return await self.chat(messages, model, provider, **kwargs)
    
    def get_provider_cost(self, provider: str, model: str, tokens: int) -> float:
        """Get cost for a provider and model"""
        # Pricing is approximate and should be updated
        pricing = {
            "anthropic": {
                "claude-3-5-sonnet-20250620": {"input": 3e-6, "output": 15e-6},
                "claude-3-haiku-20240307": {"input": 0.25e-6, "output": 1.25e-6},
                "claude-3-opus-20240229": {"input": 15e-6, "output": 75e-6},
            },
            "openai": {
                "gpt-4o-mini": {"input": 1.5e-6, "output": 6e-6},
                "gpt-4o": {"input": 5e-6, "output": 15e-6},
                "gpt-4-turbo": {"input": 10e-6, "output": 30e-6},
                "gpt-3.5-turbo": {"input": 0.5e-6, "output": 1.5e-6},
            },
            "deepseek": {
                "deepseek-chat": {"input": 0.5e-6, "output": 2e-6},
                "deepseek-coder": {"input": 0.5e-6, "output": 2e-6},
            },
            "mistral": {
                "mistral-large": {"input": 2e-6, "output": 6e-6},
                "mistral-small": {"input": 0.5e-6, "output": 1.5e-6},
                "mistral-tiny": {"input": 0.25e-6, "output": 0.75e-6},
            },
            "groq": {
                "llama-3.1-70b-versatile": {"input": 0.5e-6, "output": 1e-6},
                "llama-3.1-8b-instant": {"input": 0.2e-6, "output": 0.4e-6},
                "mixtral-8x7b-32768": {"input": 0.3e-6, "output": 0.6e-6},
            },
        }
        
        provider_pricing = pricing.get(provider.lower(), {})
        model_pricing = provider_pricing.get(model.lower(), {})
        
        input_cost = model_pricing.get("input", 0)
        output_cost = model_pricing.get("output", 0)
        
        # Assume 50% input, 50% output tokens
        return (input_cost + output_cost) * tokens / 2


# Create singleton instance
llm_service = LLMService()
