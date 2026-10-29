do $$
declare
  v_signature regprocedure :=
    to_regprocedure(
      'public.save_chat_exchange(uuid,uuid,text,text,jsonb,boolean)'
    );
begin
  if v_signature is null then
    raise exception 'Secure save_chat_exchange signature is missing.';
  end if;

  if has_function_privilege('anon', v_signature, 'EXECUTE')
    or has_function_privilege('authenticated', v_signature, 'EXECUTE')
  then
    raise exception 'A client role can execute save_chat_exchange.';
  end if;

  if not has_function_privilege('service_role', v_signature, 'EXECUTE') then
    raise exception 'service_role cannot execute save_chat_exchange.';
  end if;

  if to_regprocedure('public.save_chat_exchange(uuid,text,text,jsonb)')
      is not null
    or to_regprocedure(
      'public.save_chat_exchange(uuid,text,text,jsonb,boolean)'
    ) is not null
  then
    raise exception 'An obsolete save_chat_exchange overload remains.';
  end if;
end;
$$;
