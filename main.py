from fastapi import FastAPI, HTTPException, status, Depends
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine, SessionLocal
from sqlalchemy.orm import Session

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

origins = [
    '*'
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


# class User(BaseModel):
#     username: str = Field(min_length=5, max_length=20)
#     hashed_password: str


class BaseThread(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=1000)


class ThreadIn(BaseThread):
    pass


class ThreadOut(BaseThread):
    id: int
    created: datetime


class BaseReply(BaseModel):
    thread_id: int
    text: str = Field(min_length=1, max_length=1000)


class ReplyIn(BaseReply):
    pass


class ReplyOut(BaseReply):
    id: int
    created: datetime


@app.get(path='/')
def read_root(db: Session = Depends(get_db)):
    # TODO: Do some error handling if no threads
    return db.query(models.Thread).order_by(models.Thread.created).all()


@app.post(path='/threads/', response_model=ThreadOut)
def create_thread(thread: ThreadIn, db: Session = Depends(get_db)):
    db_thread = models.Thread()

    db_thread.title = thread.title
    db_thread.text = thread.text
    db_thread.created = datetime.now()

    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)

    return db_thread


@app.get(path='/threads/{thread_id}', response_model=ThreadOut)
def read_thread(thread_id: int, db: Session = Depends(get_db)):

    db_thread = db.query(models.Thread).filter(models.Thread.id == thread_id).first()
    if db_thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Thread with ID={thread_id} not found'
        )

    return db_thread


@app.post(path='/threads/{thread_id}/replies/', response_model=ReplyOut)
def create_reply(reply: ReplyIn, db: Session = Depends(get_db)):
    db_reply = models.Reply()

    db_reply.thread_id = reply.thread_id
    db_reply.text = reply.text
    db_reply.created = datetime.now()

    db.add(db_reply)
    db.commit()
    db.refresh(db_reply)

    return db_reply


@app.get(path='/threads/{thread_id}/replies/{reply_id}', response_model=ReplyOut)
def read_reply(thread_id: int, reply_id: int, db: Session = Depends(get_db)):
    db_reply = db.query(models.Reply).filter(models.Reply.id == reply_id, models.Reply.thread_id == thread_id).first()
    if db_reply is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Reply with ID={reply_id} in Thread with ID={thread_id} not found'
        )

    return db_reply



