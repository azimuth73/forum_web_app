from fastapi import FastAPI, HTTPException, status, Depends
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
import models
from database import engine, SessionLocal
from sqlalchemy.orm import Session

app = FastAPI()

models.Base.metadata.create_all(bind=engine)


def get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


# class User(BaseModel):
#     username: str = Field(min_length=5, max_length=20)
#     hashed_password: str


class Thread(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=1000)
    created: datetime


class Reply(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    created: datetime


@app.get('/')
def read_root(db: Session = Depends(get_db)):
    # TODO: Do some error handling if no threads
    return db.query(models.Threads).all()


@app.post('/threads/')
def create_thread(thread: Thread, db: Session = Depends(get_db)):
    thread_model = models.Threads()

    thread_model.title = thread.title
    thread_model.text = thread.text
    thread_model.created = thread.created

    db.add(thread_model)
    db.commit()

    return thread


@app.get('/threads/{thread_id}')
def read_thread(thread_id: int, db: Session = Depends(get_db)):

    thread_model = db.query(models.Threads).filter(models.Threads.id == thread_id).first()
    if thread_model is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Thread with ID={thread_id} not found'
        )

    return thread_model


@app.post('/threads/{thread_id}/replies/')
def create_reply(thread_id: int, reply: Reply):
    # TODO: Logic to add a new reply to a thread and save the reply data to a database

    return reply


@app.get('/threads/{thread_id}/replies/{reply_id}')
def read_reply(thread_id: int, reply_id: int):
    reply: Optional[Reply] = None
    # TODO: Replace with actual data retrieval logic
    if reply:
        return reply
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Reply with ID={reply_id} not found'
        )


