from fastapi import FastAPI, HTTPException, status, Depends
from typing import List
from pydantic import BaseModel, Field, StrictInt
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
    text: str = Field(min_length=1, max_length=2000)


class ThreadIn(BaseThread):
    pass


class ThreadOut(BaseThread):
    id: StrictInt = Field(gt=0)
    created: datetime


class BaseReply(BaseModel):
    thread_id: StrictInt = Field(gt=0)
    text: str = Field(min_length=1, max_length=2000)


class ReplyIn(BaseReply):
    pass


class ReplyOut(BaseReply):
    id: StrictInt = Field(gt=0)
    created: datetime


@app.get(path='/')
def read_root(db: Session = Depends(get_db)):
    # TODO: Think of what root's purpose should be, still haven't decided.
    return {'message': 'welcome'}


@app.get(path='/threads/', response_model=List[ThreadOut])
def read_threads(db: Session = Depends(get_db)):
    db_threads = db.query(models.Thread).order_by(models.Thread.created).all()
    return db_threads


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
            detail=f'Thread with ID={thread_id} not found.'
        )

    return db_thread


@app.get(path='/threads/{thread_id}/replies/', response_model=List[ReplyOut])
def read_replies(thread_id: int, db: Session = Depends(get_db)):
    # Check if the thread exists
    read_thread(thread_id=thread_id, db=db)

    # Retrieve all replies for the given thread
    db_replies = db.query(models.Reply).filter(models.Reply.thread_id == thread_id).all()
    return db_replies


@app.post(path='/replies/', response_model=ReplyOut)
def create_reply(reply: ReplyIn, db: Session = Depends(get_db)):
    db_reply = models.Reply()

    # Ensure the thread exists before attempting to create the reply
    read_thread(thread_id=reply.thread_id, db=db)

    db_reply.thread_id = reply.thread_id
    db_reply.text = reply.text
    db_reply.created = datetime.now()

    db.add(db_reply)
    db.commit()
    db.refresh(db_reply)

    return db_reply


@app.get(path='/threads/{thread_id}/replies/{reply_id}', response_model=ReplyOut)
def read_reply(thread_id: int, reply_id: int, db: Session = Depends(get_db)):
    # Ensure the thread exists before attempting to read the reply
    read_thread(thread_id=thread_id, db=db)

    db_reply = db.query(models.Reply).filter(models.Reply.id == reply_id).first()
    if db_reply is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Reply with ID={reply_id} not found.'
        )

    return db_reply
