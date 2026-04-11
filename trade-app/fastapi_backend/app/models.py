from datetime import datetime, timezone

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from uuid import uuid4


class Base(DeclarativeBase):
    pass


class User(SQLAlchemyBaseUserTableUUID, Base):
    items = relationship("Item", back_populates="user", cascade="all, delete-orphan")


class Item(Base):
    __tablename__ = "items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)

    user = relationship("User", back_populates="items")


class Debate(Base):
    __tablename__ = "debates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    external_id = Column(String, unique=True, nullable=False, index=True)
    asset = Column(String, nullable=False)
    status = Column(String, nullable=False, default="running")
    max_turns = Column(Integer, nullable=False, default=6)
    current_turn = Column(Integer, nullable=False, default=0)
    guardian_verdict = Column(String, nullable=True)
    guardian_interrupts_count = Column(Integer, nullable=False, default=0)
    transcript = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    votes = relationship("Vote", back_populates="debate", cascade="all, delete-orphan")


class Vote(Base):
    __tablename__ = "votes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    debate_id = Column(UUID(as_uuid=True), ForeignKey("debates.id"), nullable=False)
    choice = Column(String, nullable=False)
    voter_fingerprint = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    debate = relationship("Debate", back_populates="votes")

    __table_args__ = (
        Index(
            "ix_votes_debate_fingerprint_unique",
            "debate_id",
            "voter_fingerprint",
            unique=True,
        ),
    )
