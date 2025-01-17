import { useEffect, useState } from "preact/hooks";
import { useForm, SubmitHandler } from "react-hook-form";
import { route } from "preact-router";
import { styled } from "@stitches/react";
import * as Separator from '@radix-ui/react-separator';
import { Endpoints } from '../../api/endpoints';
import { NewGameWorld, useDefaultGameWorld } from '../../api/models';

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
  return (
    <div style={{ display: 'flex' }}>
      {gameWorlds.map(({ id, ...rest}, index) => (
        <>
          <Button onClick={() => route(`${id}`)}>
            {id}
          </Button>
          {index !== gameWorlds.length && (
            <Separator.Root
              clasName="SeparatorRoot"
              decorative
              orientation='vertical'
              style={{ margin: '0 15px' }}
            />
          )}
        </>
      ))}
    </div>
  )
};

const PrepNewGameForm = ({ isVisible, onCancel }) => {
  if (!isVisible) return <></>;

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
      .then((gameWorld) => route(`${gameWorld.id}`))
      .catch(console.error);

    const Container = styled('div', {
      border: '1px solid black',
      display: 'flex',
      'flex-direction': 'column'
    });

    const TextInput = styled('input', {
      type: 'text'
    });

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