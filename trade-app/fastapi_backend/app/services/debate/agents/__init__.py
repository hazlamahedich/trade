import logging

from app.services.debate.agents.bull import BullAgent
from app.services.debate.agents.bear import BearAgent

__all__ = ["BullAgent", "BearAgent"]

logger = logging.getLogger(__name__)
