import { useEffect, useState } from 'preact/hooks';
import { Endpoints } from '../../api/endpoints';
import { styled } from "@stitches/react";
import { route } from "preact-router";

const Button = styled('button', {
  backgroundColor: 'gainsboro',
  borderRadius: '5px',
  fontSize: '12px',
  padding: '10px 15px',
  '&:hover': {
    backgroundColor: 'darkgrey',
  },
});

const GameWorld = (props) => {
  const gwId = props.gwId;
  const [gw, setGw] = useState(null);

  useEffect(() => {
    const get = async () => {
      return await fetch(Endpoints.GetGameWorld.replace(':gwId', gwId), {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => response.json())
        .then(setGw)
        .catch(console.error);
    };
    get();
  }, [gwId]);

  const startNewSeason = async () => {
    await fetch(Endpoints.NewSeason.replace(':gwId', gwId), {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    }).then((response) => response.json())
      .then(setGw)
      .then(() => {
        // route to first League overview
        route(`${gwId}/${gw?.Leagues[0].id}`)
      });
  };

  if (!gw) { return ( <></> ); }

  return (
    <div>
      {!gw.config.inProgress &&
        <Button onClick={() => startNewSeason()}>Start New Season</Button>
      }
      {gw.Leagues.map((league) => (
        <>
          <Button key={league.id} onClick={() => { console.info(`Clicking league ${league.id}`); route(`${gwId}/${league.id}`); }}>{league.name}</Button>
        </>
      ))}
    </div>
  );
};

export { GameWorld };