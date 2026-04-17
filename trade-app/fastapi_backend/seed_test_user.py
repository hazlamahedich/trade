import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select
from fastapi_users.password import PasswordHelper
from app.database import async_session_maker
from app.models import User


async def main():
    email = "test@trade.dev"
    password = "TestPass1!"

    async with async_session_maker() as session:
        existing = await session.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            print(f"User {email} already exists.")
            return

        hashed = PasswordHelper().hash(password)
        user = User(
            email=email,
            hashed_password=hashed,
            is_active=True,
            is_superuser=False,
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        print(f"Created test user: {email}")
        print(f"Password: {password}")


if __name__ == "__main__":
    asyncio.run(main())
