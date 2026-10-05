import { Button, EmptyState, Screen } from '../components/Primitives';
import { useAppNavigation } from '../navigation/types';

export default function NotFoundScreen() {
  const navigation = useAppNavigation();
  return <Screen><EmptyState title="Let’s get you back." description="That page could not be found." action={<Button label="Back to Today" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Today' } }] })} />} /></Screen>;
}
