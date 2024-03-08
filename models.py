from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from database import Base


# class Users(Base):
#     __tablename__ = "users"
#
#     id = Column(Integer, primary_key=True, index=True)
#     username = Column(String)
#     hashed_password = Column(String)


class Threads(Base):
    __tablename__ = 'threads'

    id = Column(Integer, primary_key=True, index=True)
    # user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    text = Column(String)
    created = Column(DateTime)


class Replies(Base):
    __tablename__ = 'replies'

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("threads.id"))
    # user_id = Column(Integer, ForeignKey("users.id"))
    text = Column(String)
    created = Column(DateTime)




