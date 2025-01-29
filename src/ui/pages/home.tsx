import React, { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { styled } from "@stitches/react";
import { Endpoints } from '../../api/endpoints';
import { NewGameWorld, useDefaultGameWorld } from '../../api/models';
import { useNavigate } from 'react-router';

const Button = styled('button', {
  backgroundColor: 'gainsboro',
  borderRadius: '5px',
  fontSize: '12px',
  padding: '10px 15px',
  '&:hover': {
    backgroundColor: 'lightgray',
  },
});

const GameWorlds = ({ gameWorlds }) => {
  const navigate = useNavigate(); /* todo: replace with <Link /> */
  return (
    <div style={{ display: 'flex' }}>
      {gameWorlds.map(({ id, ...rest}, index) => (
        <>
          <Button onClick={() => navigate(`/${id}`)}>
            {id}
          </Button>
        </>
      ))}
    </div>
  )
};

const PrepNewGameForm = ({ isVisible, onCancel }) => {
  const navigate = useNavigate(); /* todo: replace with <Link /> */

  const { register, handleSubmit }= useForm<NewGameWorld>({
    defaultValues: useDefaultGameWorld()
  });

  const submit: SubmitHandler<NewGameWorld> = async (data) => 
    await fetch(Endpoints.NewGameWorld, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then((response) => response.json())
      .then((gameWorld) => {
        console.info(gameWorld);
        navigate(`/${gameWorld.id}`);
      })
      .catch(console.error);

    const Container = styled('div', {
      border: '1px solid black',
      display: 'flex',
      'flex-direction': 'column'
    });

    const TextInput = styled('input', {
      type: 'text'
    });

    if (!isVisible) return <></>;

    return (
      <form onSubmit={handleSubmit(submit)}>
        <Container>
          <label>Game World Name</label>
          <TextInput required {...register('name')} />
          <Button type='submit'>Create</Button>
        </Container>
      </form>
    )
};

const Home = () => {
  const [gameWorlds, setGameWorlds] = useState([]);
  const [prepNewGame, setPrepNewGame] = useState(false);

  useEffect(() => {
    const getGameWorlds = async () => {
      return await fetch(Endpoints.GetGameWorlds, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => response.json())
        .then((setGameWorlds))
        .catch(console.error);
    };
    getGameWorlds();
  }, []);

  useEffect(() => {
    // todo: leaving until we can test notifications from the server
    console.debug(`gameWorlds: ${JSON.stringify(gameWorlds)}`);
  }, [gameWorlds]);

  const onPrepNewGame = () => setPrepNewGame(true);
  const noPrepNewGame = () => setPrepNewGame(false);

  return (
    <div>
      <div>Home</div>
      <GameWorlds
        gameWorlds={gameWorlds}
      />
      <Button onClick={onPrepNewGame}>New Game</Button>
      <PrepNewGameForm
        isVisible={prepNewGame}
        onCancel={noPrepNewGame}
      />
    </div>
  )
};

export { Home };