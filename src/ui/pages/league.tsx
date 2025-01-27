import { useEffect, useState } from 'preact/hooks';
import { Endpoints } from '../../api/endpoints';

const League = (props) => {
  const gwId = props.gwId;
  const leagueId = props.leagueId;
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
    <>League {league.id} Home</>
  )
};

export { League };