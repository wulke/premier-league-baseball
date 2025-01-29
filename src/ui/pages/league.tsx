import React, { useEffect, useState } from 'react';
import { Endpoints } from '../../api/endpoints';
import { useParams } from 'react-router';

const Division = ({ division }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    console.info('Loading division: ', division);
    /* ! todo ! fetch the current table standings */
  }, [division]);

  return (
    <>
      {/* Collapsible Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <span>Division {division.id} - {division.config.name}</span>
        {/* <button className="IconButton">
          {isOpen ? <ExpandMoreIcon /> : <CloseIcon /> }
        </button> */}
      </div>
      {division.Teams.map((team) => <div>Team {team.config.name}</div>)}
    </>
  );
};

const League = () => {
  const { gwId, leagueId } = useParams();
  const [league, setLeague] = useState(null);
  
  useEffect(() => {
    const get = async () => {
      return await fetch(Endpoints.GetLeague.replace(':leagueId', leagueId), {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => response.json())
        .then(setLeague)
        .catch(console.error);
    };
    get();
  }, [leagueId]);

  if (!league) { return (<></>); }

  /* ? todo ? different view structure for league type ? */

  return (
    <>
      <p>League {league.id} Home</p>
      {league!.Divisions.map((division) => <div><Division division={division} /></div>)}
    </>
  )
};

export { League };