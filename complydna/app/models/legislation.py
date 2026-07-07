from datetime import date
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

MaddeTuru = Literal["madde", "gecici_madde"]


class YuurlulukDurumu(StrEnum):
    AKTIF = "aktif"
    MULGA = "mülga"
    DEGISIK = "değişik"


class Article(BaseModel):
    kaynak_kodu: str = Field(..., min_length=1, examples=["LAW-5549"])
    kaynak_adi: str = Field(..., min_length=1)
    madde_no: int = Field(..., ge=1)
    madde_turu: MaddeTuru = "madde"
    fikra_no: int | None = Field(default=None, ge=1)
    metin: str = Field(..., min_length=1)
    yururluk_durumu: YuurlulukDurumu = YuurlulukDurumu.AKTIF
    yururluk_tarihi: date
    surum_etiketi: str = Field(..., min_length=1, examples=["2024-01"])

    @field_validator("kaynak_kodu")
    @classmethod
    def normalize_kaynak_kodu(cls, value: str) -> str:
        return value.strip().upper()

    def citation(self) -> str:
        if self.madde_turu == "gecici_madde":
            label = f"Geçici Madde {self.madde_no}"
        else:
            label = f"Madde {self.madde_no}"
        base = f"[{self.kaynak_kodu} / {label}"
        if self.fikra_no is not None:
            base += f" f.{self.fikra_no}"
        return f"{base}]"

    def chunk_id(self) -> str:
        tur = "g" if self.madde_turu == "gecici_madde" else "m"
        fikra = self.fikra_no or 0
        return f"{self.kaynak_kodu}:{tur}{self.madde_no}:f{fikra}@{self.surum_etiketi}"

    def embedding_text(self) -> str:
        return f"{self.citation()} {self.metin}"


class CharacterRange(BaseModel):
    start: int = Field(..., ge=0)
    end: int = Field(..., ge=0)

    @field_validator("end")
    @classmethod
    def end_after_start(cls, end: int, info) -> int:
        start = info.data.get("start", 0)
        if end < start:
            msg = "end must be >= start"
            raise ValueError(msg)
        return end


class Chunk(BaseModel):
    chunk_id: str = Field(..., min_length=1)
    article: Article
    metin_parcasi: str = Field(..., min_length=1)
    karakter_araligi: CharacterRange

    @property
    def citation(self) -> str:
        return self.article.citation()
