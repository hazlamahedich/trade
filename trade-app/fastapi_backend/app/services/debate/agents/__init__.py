import logging

from app.services.debate.agents.bull import BullAgent
from app.services.debate.agents.bear import BearAgent
from app.services.debate.agents.guardian import GuardianAgent

__all__ = ["BullAgent", "BearAgent", "GuardianAgent"]

logger = logging.getLogger(__name__)
