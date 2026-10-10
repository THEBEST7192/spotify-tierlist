export const useTierEditor = ({
  state,
  setState,
  tiers,
  setTiers,
  setTierOrder,
  newTierName,
  setNewTierName,
  newTierColor,
  setNewTierColor,
  setShowAddTierForm,
  editingTier,
  setEditingTier,
  editTierName,
  setEditTierName
}) => {
  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (source.droppableId === destination.droppableId) {
      const items = Array.from(state[source.droppableId]);
      const [removed] = items.splice(source.index, 1);
      items.splice(destination.index, 0, removed);
      setState(prev => ({ ...prev, [source.droppableId]: items }));
      return;
    }

    const sourceItems = Array.from(state[source.droppableId]);
    const destinationItems = Array.from(state[destination.droppableId]);
    const [removed] = sourceItems.splice(source.index, 1);
    destinationItems.splice(destination.index, 0, removed);
    setState(prev => ({
      ...prev,
      [source.droppableId]: sourceItems,
      [destination.droppableId]: destinationItems
    }));
  };

  const addTier = () => {
    if (!newTierName.trim()) return;
    if (tiers[newTierName]) {
      alert("A tier with this name already exists!");
      return;
    }

    setTiers(prev => ({
      ...prev,
      [newTierName]: { color: newTierColor, label: newTierName }
    }));
    setTierOrder(prev => {
      const unrankedIndex = prev.indexOf("Unranked");
      const newOrder = [...prev];
      newOrder.splice(unrankedIndex, 0, newTierName);
      return newOrder;
    });
    setState(prev => ({ ...prev, [newTierName]: [] }));
    setNewTierName("");
    setNewTierColor("#CCCCCC");
    setShowAddTierForm(false);
  };

  const deleteTier = (tierId) => {
    if (tierId === "Unranked") {
      alert("Cannot delete the Unranked tier!");
      return;
    }

    if (state[tierId]?.length > 0) {
      if (!window.confirm(`The tier "${tierId}" contains ${state[tierId].length} songs. Do you want to move them to the Unranked tier?`)) return;
      setState(prev => ({
        ...prev,
        Unranked: [...prev.Unranked, ...prev[tierId]],
        [tierId]: []
      }));
    }

    setTierOrder(prev => prev.filter(tier => tier !== tierId));
    setTiers(prev => {
      const newTiers = { ...prev };
      delete newTiers[tierId];
      return newTiers;
    });
  };

  const moveTierUp = (tierId) => {
    if (tierId === "Unranked") return;
    setTierOrder(prev => {
      const index = prev.indexOf(tierId);
      if (index <= 0) return prev;
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  };

  const moveTierDown = (tierId) => {
    if (tierId === "Unranked") return;
    setTierOrder(prev => {
      const index = prev.indexOf(tierId);
      if (index === -1 || index === prev.length - 1) return prev;
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
  };

  const startEditingTier = (tierId) => {
    if (tierId === "Unranked") {
      alert("Cannot rename the Unranked tier!");
      return;
    }
    setEditingTier(tierId);
    setEditTierName(tierId);
  };

  const saveTierName = () => {
    if (!editTierName.trim() || editTierName === editingTier) {
      setEditingTier(null);
      return;
    }
    if (tiers[editTierName]) {
      alert("A tier with this name already exists!");
      return;
    }

    setTiers(prev => {
      const newTiers = { ...prev };
      const tierData = newTiers[editingTier];
      delete newTiers[editingTier];
      newTiers[editTierName] = { ...tierData, label: editTierName };
      return newTiers;
    });
    setTierOrder(prev => prev.map(tier => tier === editingTier ? editTierName : tier));
    setState(prev => {
      const newState = { ...prev };
      newState[editTierName] = prev[editingTier];
      delete newState[editingTier];
      return newState;
    });
    setEditingTier(null);
  };

  const cancelTierEdit = () => setEditingTier(null);

  return {
    onDragEnd,
    addTier,
    deleteTier,
    moveTierUp,
    moveTierDown,
    startEditingTier,
    saveTierName,
    cancelTierEdit
  };
};
