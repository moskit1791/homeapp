alter table shopping_list_items
add column if not exists expiration_date date null;

create index if not exists shopping_list_items_expiration_date_idx
on shopping_list_items (shopping_list_id, expiration_date)
where expiration_date is not null;
