from __future__ import annotations

import base64
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings

try:  # pragma: no cover - import opcional em ambientes sem SDK
    from google import genai  # type: ignore
    from google.genai import types as genai_types  # type: ignore
except Exception:  # pragma: no cover
    genai = None  # type: ignore
    genai_types = None  # type: ignore

logger = logging.getLogger(__name__)


class CopilotProviderError(RuntimeError):
    def __init__(
        self,
        *,
        code: str,
        user_message: str,
        provider: str | None = None,
    ) -> None:
        super().__init__(code)
        self.code = code
        self.user_message = user_message
        self.provider = provider


@dataclass
class ProviderCallMetadata:
    requested_provider: str
    used_provider: str | None = None
    model: str | None = None
    category: str | None = None
    web_search_requested: bool = False
    web_search_used: bool = False
    fallback_triggered: bool = False
    fallback_reason: str | None = None
    sources: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "requested_provider": self.requested_provider,
            "used_provider": self.used_provider,
            "model": self.model,
            "category": self.category,
            "web_search_requested": self.web_search_requested,
            "web_search_used": self.web_search_used,
            "fallback_triggered": self.fallback_triggered,
            "fallback_reason": self.fallback_reason,
            "sources": self.sources,
        }


def _normalize_provider_name(value: str | None, *, default: str = "disabled") -> str:
    text = str(value or "").strip().lower()
    return text or default


def _strip_text(value: str | None) -> str:
    return str(value or "").strip()


def _as_timeout(value: Any, *, default: int = 60) -> int:
    try:
        parsed = int(value)
    except Exception:
        parsed = default
    return max(1, parsed)


def _is_http_url(value: str | None) -> bool:
    text = _strip_text(value).lower()
    return text.startswith("http://") or text.startswith("https://")


def _is_timeout_error(error_text: str) -> bool:
    return any(
        token in error_text
        for token in (
            "timeout",
            "timed out",
            "deadline",
            "read timeout",
            "connect timeout",
        )
    )


def _is_auth_error(error_text: str) -> bool:
    return any(
        token in error_text
        for token in (
            "401",
            "403",
            "permission denied",
            "unauthorized",
            "invalid api key",
            "api key not valid",
            "forbidden",
            "authentication",
        )
    )


def _is_rate_limit_error(error_text: str) -> bool:
    return any(
        token in error_text
        for token in (
            "429",
            "rate limit",
            "quota",
            "resource exhausted",
            "too many requests",
        )
    )


def _is_unavailable_error(error_text: str) -> bool:
    return any(
        token in error_text
        for token in (
            "503",
            "502",
            "service unavailable",
            "connection refused",
            "temporarily unavailable",
            "network",
        )
    )


class CopilotProviderClient:
    def __init__(self) -> None:
        self.provider = _normalize_provider_name(settings.COPILOT_PROVIDER, default="gemini")
        self.model = _strip_text(settings.COPILOT_PROVIDER_MODEL) or "gemini-2.5-flash"
        self.timeout = _as_timeout(settings.COPILOT_PROVIDER_TIMEOUT_SECONDS, default=60)
        self.enable_web_search = bool(settings.COPILOT_PROVIDER_ENABLE_WEB_SEARCH)
        self.gemini_api_key = _strip_text(settings.GEMINI_API_KEY)

        self.fallback_provider = _normalize_provider_name(settings.COPILOT_FALLBACK_PROVIDER, default="")
        self.fallback_model = _strip_text(settings.COPILOT_FALLBACK_MODEL) or "gemma3:4b"
        self.fallback_timeout = _as_timeout(settings.COPILOT_FALLBACK_TIMEOUT_SECONDS, default=60)
        self.fallback_base_url = _strip_text(settings.COPILOT_FALLBACK_BASE_URL)

        # compatibilidade com env legada (somente para ollama fallback)
        legacy_base_url = _strip_text(settings.COPILOT_PROVIDER_BASE_URL)
        if not self.fallback_base_url and _is_http_url(legacy_base_url):
            self.fallback_base_url = legacy_base_url.rstrip("/")

        self._last_call_metadata = ProviderCallMetadata(requested_provider=self.provider)

    @property
    def enabled(self) -> bool:
        return self.provider != "disabled" or self._fallback_enabled()

    def _fallback_enabled(self) -> bool:
        if self.fallback_provider != "ollama":
            return False
        return _is_http_url(self.fallback_base_url)

    def info(self) -> dict[str, Any]:
        data = {
            "provider": self.provider,
            "enabled": self.enabled,
            "model": self.model,
            "web_search_enabled": self.enable_web_search,
            "fallback_provider": self.fallback_provider if self._fallback_enabled() else None,
            "fallback_model": self.fallback_model if self._fallback_enabled() else None,
            "provider_used": self._last_call_metadata.used_provider,
            "fallback_triggered": self._last_call_metadata.fallback_triggered,
        }
        return data

    def last_call_metadata(self) -> dict[str, Any]:
        return self._last_call_metadata.to_dict()

    def generate(
        self,
        *,
        prompt: str,
        system_prompt: str | None = None,
        images_b64: list[str] | None = None,
        category: str | None = None,
        enable_web_search: bool = False,
        require_provider: bool = False,
    ) -> str | None:
        self._last_call_metadata = ProviderCallMetadata(
            requested_provider=self.provider,
            category=category,
            web_search_requested=bool(enable_web_search),
        )
        if not self.enabled:
            if require_provider:
                raise CopilotProviderError(
                    code="PROVIDER_DISABLED",
                    user_message="Provider do Copiloto desabilitado.",
                    provider=self.provider,
                )
            return None

        primary_error: CopilotProviderError | None = None
        if self.provider != "disabled":
            try:
                generated, sources, web_used = self._generate_by_provider(
                    provider=self.provider,
                    model=self.model,
                    timeout=self.timeout,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    images_b64=images_b64,
                    enable_web_search=enable_web_search,
                )
                if generated:
                    self._last_call_metadata.used_provider = self.provider
                    self._last_call_metadata.model = self.model
                    self._last_call_metadata.web_search_used = web_used
                    self._last_call_metadata.sources = sources
                    logger.info(
                        "Copilot provider success",
                        extra={
                            "provider_requested": self.provider,
                            "provider_used": self.provider,
                            "model": self.model,
                            "category": category,
                            "web_search_requested": bool(enable_web_search),
                            "web_search_used": web_used,
                            "sources_count": len(sources),
                            "fallback_triggered": False,
                        },
                    )
                    return generated
            except CopilotProviderError as exc:
                primary_error = exc
                logger.warning(
                    "Copilot provider failed provider=%s model=%s category=%s error_code=%s",
                    self.provider,
                    self.model,
                    category or "",
                    exc.code,
                )

        if self._fallback_enabled():
            fallback_reason = primary_error.code if primary_error else "PRIMARY_EMPTY_RESPONSE"
            self._last_call_metadata.fallback_triggered = True
            self._last_call_metadata.fallback_reason = fallback_reason
            logger.warning(
                "Copilot fallback triggered primary=%s fallback=%s category=%s reason=%s",
                self.provider,
                self.fallback_provider,
                category or "",
                fallback_reason,
            )
            try:
                generated, sources, _ = self._generate_by_provider(
                    provider=self.fallback_provider,
                    model=self.fallback_model,
                    timeout=self.fallback_timeout,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    images_b64=images_b64,
                    enable_web_search=False,
                )
                if generated:
                    self._last_call_metadata.used_provider = self.fallback_provider
                    self._last_call_metadata.model = self.fallback_model
                    self._last_call_metadata.web_search_used = False
                    self._last_call_metadata.sources = sources
                    logger.info(
                        "Copilot fallback success",
                        extra={
                            "provider_requested": self.provider,
                            "provider_used": self.fallback_provider,
                            "model": self.fallback_model,
                            "category": category,
                            "fallback_triggered": True,
                        },
                    )
                    return generated
            except CopilotProviderError as fallback_error:
                logger.warning(
                    "Copilot fallback failed fallback=%s model=%s category=%s error_code=%s",
                    self.fallback_provider,
                    self.fallback_model,
                    category or "",
                    fallback_error.code,
                )
                if require_provider:
                    message = (
                        "Não foi possível obter resposta do Copiloto no provider principal nem no fallback local."
                    )
                    raise CopilotProviderError(
                        code="PROVIDER_FALLBACK_EXHAUSTED",
                        user_message=message,
                        provider=self.fallback_provider,
                    ) from fallback_error
                return None

        if primary_error and require_provider:
            raise primary_error
        return None

    def _generate_by_provider(
        self,
        *,
        provider: str,
        model: str,
        timeout: int,
        prompt: str,
        system_prompt: str | None,
        images_b64: list[str] | None,
        enable_web_search: bool,
    ) -> tuple[str | None, list[dict[str, str]], bool]:
        if provider == "gemini":
            return self._generate_gemini(
                model=model,
                timeout=timeout,
                prompt=prompt,
                system_prompt=system_prompt,
                images_b64=images_b64,
                enable_web_search=enable_web_search,
            )
        if provider == "ollama":
            return self._generate_ollama(
                model=model,
                timeout=timeout,
                prompt=prompt,
                system_prompt=system_prompt,
                images_b64=images_b64,
            )
        raise CopilotProviderError(
            code="PROVIDER_NOT_SUPPORTED",
            user_message=f"Provider '{provider}' não suportado no Copiloto.",
            provider=provider,
        )

    def _generate_gemini(
        self,
        *,
        model: str,
        timeout: int,
        prompt: str,
        system_prompt: str | None,
        images_b64: list[str] | None,
        enable_web_search: bool,
    ) -> tuple[str | None, list[dict[str, str]], bool]:
        if not self.gemini_api_key:
            raise CopilotProviderError(
                code="GEMINI_API_KEY_MISSING",
                user_message="Chave Gemini ausente. Configure GEMINI_API_KEY.",
                provider="gemini",
            )
        if genai is None:
            raise CopilotProviderError(
                code="GEMINI_SDK_UNAVAILABLE",
                user_message="SDK oficial do Gemini indisponível no ambiente.",
                provider="gemini",
            )

        try:
            client = genai.Client(api_key=self.gemini_api_key, http_options={"timeout": timeout * 1000})
            parts: list[Any] = []
            text_prompt = _strip_text(prompt)
            if text_prompt:
                parts.append(text_prompt)
            for item in images_b64 or []:
                if not item:
                    continue
                try:
                    image_bytes = base64.b64decode(item)
                    if genai_types is not None:
                        parts.append(genai_types.Part.from_bytes(data=image_bytes, mime_type="image/png"))
                except Exception:
                    continue
            if not parts:
                return None, [], False

            config_kwargs: dict[str, Any] = {}
            if system_prompt:
                config_kwargs["system_instruction"] = system_prompt
            use_web_search = bool(enable_web_search and self.enable_web_search)
            if use_web_search and genai_types is not None:
                config_kwargs["tools"] = [genai_types.Tool(google_search=genai_types.GoogleSearch())]

            config: Any = None
            if config_kwargs:
                config = (
                    genai_types.GenerateContentConfig(**config_kwargs)
                    if genai_types is not None
                    else config_kwargs
                )

            response = client.models.generate_content(
                model=model,
                contents=parts if len(parts) > 1 else parts[0],
                config=config,
            )
            output = self._extract_response_text(response)
            if not output:
                return None, self._extract_sources(response), use_web_search
            return output, self._extract_sources(response), use_web_search
        except CopilotProviderError:
            raise
        except Exception as exc:
            raise self._map_exception(exc, provider="gemini") from exc

    def _generate_ollama(
        self,
        *,
        model: str,
        timeout: int,
        prompt: str,
        system_prompt: str | None,
        images_b64: list[str] | None,
    ) -> tuple[str | None, list[dict[str, str]], bool]:
        if not self.fallback_base_url:
            raise CopilotProviderError(
                code="OLLAMA_BASE_URL_MISSING",
                user_message="Fallback Ollama configurado sem URL base válida.",
                provider="ollama",
            )

        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": False,
        }
        if system_prompt:
            payload["system"] = system_prompt
        if images_b64:
            payload["images"] = images_b64
        endpoint = f"{self.fallback_base_url.rstrip('/')}/api/generate"
        try:
            with httpx.Client(timeout=timeout, trust_env=False) as client:
                response = client.post(endpoint, json=payload)
            if response.status_code in (401, 403):
                raise CopilotProviderError(
                    code="PROVIDER_AUTH_ERROR",
                    user_message="Falha de autenticação no provider configurado.",
                    provider="ollama",
                )
            if response.status_code == 429:
                raise CopilotProviderError(
                    code="PROVIDER_RATE_LIMIT",
                    user_message="Limite de requisições do provider atingido no momento.",
                    provider="ollama",
                )
            if response.status_code >= 500:
                raise CopilotProviderError(
                    code="PROVIDER_UNAVAILABLE",
                    user_message="Provider temporariamente indisponível. Tente novamente.",
                    provider="ollama",
                )
            if response.status_code >= 400:
                raise CopilotProviderError(
                    code="PROVIDER_REQUEST_ERROR",
                    user_message="Falha na requisição ao provider configurado.",
                    provider="ollama",
                )
            data = response.json() if response.content else {}
            text = data.get("text") or data.get("output") or data.get("response")
            if text is None:
                return None, [], False
            rendered = str(text).strip()
            return rendered or None, [], False
        except CopilotProviderError:
            raise
        except httpx.TimeoutException as exc:
            raise CopilotProviderError(
                code="PROVIDER_TIMEOUT",
                user_message="Tempo limite excedido ao consultar o provider.",
                provider="ollama",
            ) from exc
        except httpx.ConnectError as exc:
            raise CopilotProviderError(
                code="PROVIDER_UNAVAILABLE",
                user_message="Provider temporariamente indisponível. Tente novamente.",
                provider="ollama",
            ) from exc
        except Exception as exc:
            raise self._map_exception(exc, provider="ollama") from exc

    def _map_exception(self, exc: Exception, *, provider: str) -> CopilotProviderError:
        text = str(exc).strip().lower()
        if _is_timeout_error(text):
            return CopilotProviderError(
                code="PROVIDER_TIMEOUT",
                user_message="Tempo limite excedido ao consultar o provider.",
                provider=provider,
            )
        if _is_rate_limit_error(text):
            return CopilotProviderError(
                code="PROVIDER_RATE_LIMIT",
                user_message="Limite de requisições do provider atingido no momento.",
                provider=provider,
            )
        if _is_auth_error(text):
            return CopilotProviderError(
                code="PROVIDER_AUTH_ERROR",
                user_message="Falha de autenticação no provider configurado.",
                provider=provider,
            )
        if _is_unavailable_error(text):
            return CopilotProviderError(
                code="PROVIDER_UNAVAILABLE",
                user_message="Provider temporariamente indisponível. Tente novamente.",
                provider=provider,
            )
        return CopilotProviderError(
            code="PROVIDER_UNKNOWN_ERROR",
            user_message="Falha inesperada ao consultar o Copiloto.",
            provider=provider,
        )

    def _extract_response_text(self, response: Any) -> str | None:
        direct = _strip_text(getattr(response, "text", None))
        if direct:
            return direct
        as_dict = self._to_dict(response)
        candidates = as_dict.get("candidates") if isinstance(as_dict, dict) else None
        if not isinstance(candidates, list):
            return None
        fragments: list[str] = []
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            content = candidate.get("content")
            if not isinstance(content, dict):
                continue
            parts = content.get("parts")
            if not isinstance(parts, list):
                continue
            for part in parts:
                if isinstance(part, dict):
                    text = _strip_text(part.get("text"))
                    if text:
                        fragments.append(text)
        if not fragments:
            return None
        return "\n".join(fragments).strip() or None

    def _to_dict(self, response: Any) -> dict[str, Any]:
        if isinstance(response, dict):
            return response
        model_dump = getattr(response, "model_dump", None)
        if callable(model_dump):
            try:
                payload = model_dump()
                if isinstance(payload, dict):
                    return payload
            except Exception:
                return {}
        return {}

    def _extract_sources(self, response: Any) -> list[dict[str, str]]:
        data = self._to_dict(response)
        if not isinstance(data, dict):
            return []
        unique: dict[str, dict[str, str]] = {}

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                possible_url = _strip_text(
                    value.get("uri")
                    or value.get("url")
                    or value.get("link")
                    or value.get("source_uri")
                )
                if possible_url.lower().startswith(("http://", "https://")):
                    title = _strip_text(
                        value.get("title")
                        or value.get("display_name")
                        or value.get("name")
                        or possible_url
                    )
                    snippet = _strip_text(value.get("snippet") or value.get("text") or "")
                    unique[possible_url] = {
                        "title": title,
                        "url": possible_url,
                        "snippet": snippet,
                    }
                for nested in value.values():
                    visit(nested)
                return
            if isinstance(value, list):
                for nested in value:
                    visit(nested)

        visit(data)
        return list(unique.values())[:8]
