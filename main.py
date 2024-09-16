from fastapi import FastAPI, HTTPException, status, Depends, Security
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, HTTPAuthorizationCredentials, HTTPBearer
from typing import List
from pydantic import BaseModel, Field, StrictInt
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine, SessionLocal
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from typing import Optional

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

# CORS settings
origins = ['*']
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# JWT settings
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Security scheme for Swagger UI
security = HTTPBearer()


# Database dependency
def get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


# Pydantic models
class UserCreate(BaseModel):
    username: str = Field(min_length=4, max_length=20)
    password: str


class User(BaseModel):
    id: int
    username: str
    is_admin: bool


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class BaseThread(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=2000)


class ThreadIn(BaseThread):
    pass


class ThreadOut(BaseThread):
    id: StrictInt = Field(gt=0)
    created: datetime
    user_id: int
    edited: bool


class BaseReply(BaseModel):
    thread_id: StrictInt = Field(gt=0)
    text: str = Field(min_length=1, max_length=2000)


class ReplyIn(BaseReply):
    pass


class ReplyOut(BaseReply):
    id: StrictInt = Field(gt=0)
    created: datetime
    user_id: int
    edited: bool


# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def authenticate_user(db: Session, username: str, password: str):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not verify_password(password, user.password):
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# Dependency to get the current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user


# Dependency to check if the current user is an admin
def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user


# Routes
@app.post("/register", response_model=User)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if any user already exists in the database
    user_count = db.query(models.User).count()

    # Check if the username is already taken
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Hash the password
    hashed_password = get_password_hash(user.password)

    # If no users exist, make this user an admin
    is_admin = user_count == 0

    # Create the new user
    new_user = models.User(username=user.username, password=hashed_password, is_admin=is_admin)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/")
def read_root():
    return {"message": "Welcome to the forum API"}


@app.get("/threads/", response_model=List[ThreadOut])
def read_threads(db: Session = Depends(get_db)):
    db_threads = db.query(models.Thread).order_by(models.Thread.created.desc()).all()
    return db_threads


@app.post("/threads/", response_model=ThreadOut)
def create_thread(thread: ThreadIn, current_user: User = Security(get_current_user), db: Session = Depends(get_db)):
    db_thread = models.Thread(
        title=thread.title,
        text=thread.text,
        created=datetime.now(),
        user_id=current_user.id,
        edited=False
    )
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    return db_thread


@app.get("/threads/{thread_id}", response_model=ThreadOut)
def read_thread(thread_id: int, db: Session = Depends(get_db)):
    db_thread = db.query(models.Thread).filter(models.Thread.id == thread_id).first()
    if db_thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    return db_thread


@app.get("/threads/{thread_id}/replies/", response_model=List[ReplyOut])
def read_replies(thread_id: int, db: Session = Depends(get_db)):
    # Check if the thread exists
    read_thread(thread_id=thread_id, db=db)

    db_replies = db.query(models.Reply).filter(models.Reply.thread_id == thread_id).all()
    return db_replies


@app.post("/replies/", response_model=ReplyOut)
def create_reply(reply: ReplyIn, current_user: User = Security(get_current_user), db: Session = Depends(get_db)):
    # Ensure the thread exists before attempting to create the reply
    read_thread(thread_id=reply.thread_id, db=db)

    db_reply = models.Reply(
        thread_id=reply.thread_id,
        text=reply.text,
        created=datetime.now(),
        user_id=current_user.id,
        edited=False
    )
    db.add(db_reply)
    db.commit()
    db.refresh(db_reply)
    return db_reply


@app.get("/threads/{thread_id}/replies/{reply_id}", response_model=ReplyOut)
def read_reply(thread_id: int, reply_id: int, db: Session = Depends(get_db)):
    # Ensure the thread exists before attempting to read the reply
    read_thread(thread_id=thread_id, db=db)

    db_reply = db.query(models.Reply).filter(models.Reply.id == reply_id, models.Reply.thread_id == thread_id).first()
    if db_reply is None:
        raise HTTPException(status_code=404, detail="Reply not found")
    return db_reply


# Route to get all users
@app.get("/users/", response_model=List[User])
def read_users(db: Session = Depends(get_db)):
    db_users = db.query(models.User).all()
    return db_users


# Get current logged-in user
@app.get("/users/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@app.put("/users/{user_id}/make-admin", response_model=User)
def make_admin(user_id: int, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.is_admin = True
    db.commit()
    db.refresh(db_user)
    return db_user


@app.delete("/replies/{reply_id}", response_model=ReplyOut)
def delete_reply(reply_id: int, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    db_reply = db.query(models.Reply).filter(models.Reply.id == reply_id).first()
    if db_reply is None:
        raise HTTPException(status_code=404, detail="Reply not found")

    db.delete(db_reply)
    db.commit()
    return db_reply


@app.delete("/threads/{thread_id}", response_model=ThreadOut)
def delete_thread(thread_id: int, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    # Fetch the thread
    db_thread = db.query(models.Thread).filter(models.Thread.id == thread_id).first()
    if db_thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Fetch all replies related to the thread
    db_replies = db.query(models.Reply).filter(models.Reply.thread_id == thread_id).all()

    # Delete all replies
    for reply in db_replies:
        db.delete(reply)

    # Delete the thread
    db.delete(db_thread)
    db.commit()

    return db_thread


class ThreadEdit(BaseModel):
    title: str = Field(min_length=1, max_length=200, description="Title of the thread")
    text: str = Field(min_length=1, max_length=2000, description="Text of the thread")


class ReplyEdit(BaseModel):
    text: str = Field(min_length=1, max_length=2000, description="Text of the reply")


# Edit a thread
@app.put("/threads/{thread_id}/edit", response_model=ThreadOut)
def edit_thread(thread_id: int, thread_data: ThreadEdit, current_user: User = Security(get_current_user), db: Session = Depends(get_db)):
    # Fetch the thread
    db_thread = db.query(models.Thread).filter(models.Thread.id == thread_id).first()
    if db_thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Check if the current user is the owner of the thread
    if db_thread.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to edit this thread")

    # Update thread title and text, and mark as edited
    db_thread.title = thread_data.title
    db_thread.text = thread_data.text
    db_thread.edited = True
    db.commit()
    db.refresh(db_thread)
    return db_thread


# Edit a reply
@app.put("/replies/{reply_id}/edit", response_model=ReplyOut)
def edit_reply(reply_id: int, reply_data: ReplyEdit, current_user: User = Security(get_current_user), db: Session = Depends(get_db)):
    # Fetch the reply
    db_reply = db.query(models.Reply).filter(models.Reply.id == reply_id).first()
    if db_reply is None:
        raise HTTPException(status_code=404, detail="Reply not found")

    # Check if the current user is the owner of the reply
    if db_reply.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to edit this reply")

    # Update reply text and mark as edited
    db_reply.text = reply_data.text
    db_reply.edited = True
    db.commit()
    db.refresh(db_reply)
    return db_reply
