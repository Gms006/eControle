import os
from typing import Any, Optional

import httpx


class CertHubClient:
    """
    Client flexivel porque o contrato ainda nao fixou o path exato no CertHub.
    Use CERTHUB_CERTS_LIST_URL_TEMPLATE para definir a URL (pode conter {org_id} e/ou {org_slug}).
    """

    def __init__(
        self,
        base_url: str,
        api_token: Optional[str],
        list_url_template: str,
        timeout_seconds: int = 30,
        verify: bool | str = True,
        login_url: Optional[str] = None,
        email: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.list_url_template = list_url_template
        self.timeout_seconds = timeout_seconds
        self.verify = verify
        self.login_url = login_url
        self.email = email
        self.password = password
        self._cached_token: Optional[str] = None

    @staticmethod
    def _env_bool(name: str, default: bool = True) -> bool:
        value = (os.getenv(name, "").strip() or "").lower()
        if not value:
            return default
        return value in ("1", "true", "yes", "y", "on")

    @classmethod
    def from_env(cls) -> "CertHubClient":
        base = os.getenv("CERTHUB_BASE_URL", "").strip()
        token = os.getenv("CERTHUB_API_TOKEN", "").strip() or None
        tpl = os.getenv("CERTHUB_CERTS_LIST_URL_TEMPLATE", "").strip()
        verify_tls = cls._env_bool("CERTHUB_VERIFY_TLS", True)
        ca_bundle = os.getenv("CERTHUB_CA_BUNDLE", "").strip() or None
        login_url = os.getenv("CERTHUB_AUTH_LOGIN_URL", "").strip() or None
        email = os.getenv("CERTHUB_EMAIL", "").strip() or None
        password = os.getenv("CERTHUB_PASSWORD", "").strip() or None

        verify: bool | str = verify_tls
        if ca_bundle:
            verify = ca_bundle

        if not base:
            raise RuntimeError("CERTHUB_BASE_URL nao configurado")
        if not tpl:
            raise RuntimeError("CERTHUB_CERTS_LIST_URL_TEMPLATE nao configurado")

        # Aceita template relativo (comecando com /) ou absoluto.
        if tpl.startswith("/"):
            tpl = f"{base.rstrip('/')}{tpl}"

        return cls(
            base_url=base,
            api_token=token,
            list_url_template=tpl,
            verify=verify,
            login_url=login_url,
            email=email,
            password=password,
        )

    def _ensure_token(self) -> Optional[str]:
        # 1) token fixo
        if self.api_token:
            return self.api_token
        # 2) token cacheado
        if self._cached_token:
            return self._cached_token
        # 3) login automatico
        if not (self.login_url and self.email and self.password):
            return None
        with httpx.Client(timeout=self.timeout_seconds, verify=self.verify) as client:
            response = client.post(self.login_url, json={"email": self.email, "password": self.password})
            response.raise_for_status()
            token = response.json().get("access_token")
            if not token:
                raise RuntimeError("CertHub login sem access_token")
            self._cached_token = token
            return token

    def list_certificates(self, org_id: str, org_slug: Optional[str] = None) -> list[dict[str, Any]]:
        url = self.list_url_template.format(org_id=org_id, org_slug=(org_slug or ""))
        headers: dict[str, str] = {}
        token = self._ensure_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if org_slug:
            headers["X-Org-Slug"] = org_slug

        with httpx.Client(timeout=self.timeout_seconds, verify=self.verify) as client:
            response = client.get(url, headers=headers)
            # Se der 401 e estiver em modo de login automatico, reloga 1x.
            if response.status_code == 401 and (not self.api_token) and self.login_url:
                self._cached_token = None
                token = self._ensure_token()
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                    response = client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()

        # Tolera formatos comuns.
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            if "items" in data and isinstance(data["items"], list):
                return data["items"]
            if "certificates" in data and isinstance(data["certificates"], list):
                return data["certificates"]
        raise ValueError(f"Resposta inesperada do CertHub em {url}: {type(data)}")
