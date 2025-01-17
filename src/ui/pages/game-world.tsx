import { useEffect, useState } from 'preact/hooks';
import { Endpoints } from '../../api/endpoints';

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

  return (
    <div>
      Game World: {JSON.stringify(gw)}
    </div>
  );
};

export { GameWorld };