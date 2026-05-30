from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base


class Athlete(Base):
    __tablename__ = "athletes"

    id = Column(Integer, primary_key=True)
    strava_id = Column(Integer, unique=True, nullable=False)
    firstname = Column(String)
    lastname = Column(String)
    access_token = Column(String)
    refresh_token = Column(String)


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True)
    strava_id = Column(Integer, unique=True, nullable=False)
    athlete_id = Column(Integer, nullable=False)
    name = Column(String)
    type = Column(String)
    distance = Column(Float)
    moving_time = Column(Integer)
    start_date_local = Column(DateTime)
