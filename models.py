from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    is_admin = Column(Boolean, default=False)


class Thread(Base):
    __tablename__ = 'threads'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    text = Column(String)
    created = Column(DateTime)


class Reply(Base):
    __tablename__ = 'replies'

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("threads.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    text = Column(String)
    created = Column(DateTime)
