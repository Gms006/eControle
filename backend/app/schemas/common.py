from __future__ import annotations

from typing import Generic, List, TypeVar

from pydantic import BaseModel
from pydantic.generics import GenericModel

T = TypeVar("T")


class PaginatedResponse(GenericModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int

    model_config = {
        "from_attributes": True,
    }


class Message(BaseModel):
    detail: str
