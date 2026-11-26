do $seed$
declare
  form_id constant uuid := 'fe816150-8c12-4b3a-b04a-000000000011';
  category uuid;
  item record;
  question_id uuid;
begin
  select id into strict category from public.exam_categories where slug = 'cefr';
  insert into public.tests(id,category_id,title,section,duration,published,description,instructions,passage_title,passage_text)
  values (
    form_id,category,'CEFR · Multilevel Reading','Reading',20,true,
    'Two original reading texts with twelve practice questions.',
    'Read both texts and choose one answer for each question.',
    'Reading passages A and B',
    $passage$A. A library of things

When the Riverside Library opened a tool-lending service, its staff expected the busiest users to be experienced home repairers. The first month produced a surprise: many visitors had never used a drill or repaired a bicycle. To help people get started, volunteers began offering short demonstrations on Saturday mornings. Borrowers could reserve equipment for three days, and the demonstrations were useful even for people who did not intend to borrow anything that week.

The service started with tools donated by local households, but not everything offered could be used. Several items were too heavy for the shelves, and some lacked safety instructions. The library kept only equipment it could check and maintain. It also introduced a return checklist so users could report missing parts. Staff judged the first year by how often the equipment was returned ready for its next borrower, as well as by the number of loans.

B. The cost of a cooler street

In the fictional city of Norcott, researchers compared two streets before and after one received new shade structures. The streets had similar traffic levels and building heights, but only the shaded street also gained several benches. On warm afternoons, people spent longer on the improved street. Evening observations, however, showed little difference between the two locations.

The council initially credited the shade for the increase. The researchers were more cautious: they had measured where people stayed, but had not separated the effect of shade from the opportunity to sit down. They proposed a follow-up study in which shade and seating would be installed independently at different sites. They also recommended collecting data during very hot weather, because the initial observations had taken place in a relatively mild summer.

The report did not reject the project. Rather, it argued that an intervention can be worthwhile even when the reason it succeeds is still uncertain. If the council understood which changes mattered most, it could invest in a better combination of improvements on streets with less space.$passage$
  )
  on conflict (id) do nothing;
  if not found then return; end if;

  for item in select * from (values
    (0,'A','Who surprised the librarians during the first month?',array['People with little experience using tools','Professional repairers','Library volunteers','People who only wanted to buy tools'],1,'The first paragraph says many new users had never used a drill or repaired a bicycle.'),
    (1,'A','Why did volunteers begin giving demonstrations?',array['To repair all returned equipment','To help beginners use tools','To require a lesson before every loan','To persuade visitors to donate tools'],2,'The demonstrations were introduced to help people get started.'),
    (2,'A','How long could users reserve equipment for?',array['One morning','One week','Three days','One month'],3,'The first paragraph gives a three-day reservation period.'),
    (3,'A','Why were some donations refused?',array['The library had already bought enough tools','All donated tools were difficult to repair','Donors wanted the tools back','Some items could not be stored or checked safely'],4,'Some items were too heavy or lacked safety instructions.'),
    (4,'A','What was the purpose of the return checklist?',array['To tell staff about parts that were missing','To recommend equipment for sale','To limit the number of volunteers','To record the price of each tool'],1,'The checklist let borrowers report missing parts.'),
    (5,'A','What mattered to the library besides the number of loans?',array['The age of the borrowers','Whether tools were ready to be borrowed again','Which volunteers gave more demonstrations','How many tools visitors purchased'],2,'The service also measured how often equipment was returned ready for its next borrower.'),
    (6,'B','What did the researchers observe on warm afternoons?',array['Traffic decreased in both streets','People spent more time on the improved street','The unshaded street was busier','Both streets gained the same number of benches'],2,'The first paragraph reports longer stays on the improved street on warm afternoons.'),
    (7,'B','Why did the researchers question the council’s explanation?',array['They had not measured building height','The two streets had very different traffic','Shade and seating were added to the same street','They had collected data only in the evening'],3,'The design could not isolate the effect of shade from the effect of having somewhere to sit.'),
    (8,'B','What change did the researchers suggest for the follow-up?',array['Install shade and seats separately','Use the same one street again without changes','Remove all existing benches','Observe visitors only on cooler days'],1,'The report proposes installing shade and seating independently across sites.'),
    (9,'B','What was a limitation of the weather data?',array['It covered only one unusually hot day','It was collected in winter','Temperatures were never measured in either street','The original summer was relatively mild'],4,'The researchers recommended observations in very hot weather because their first summer was mild.'),
    (10,'B','What is the main point of the final paragraph?',array['Only projects with a proven cause are worthwhile','A useful project can succeed before its causes are clear','There is no point measuring how people use a street','Shade matters more on streets with less space'],2,'The last paragraph treats usefulness and knowledge of the exact reason as different questions.'),
    (11,'B','What would better evidence help the council decide?',array['Whether to stop all street improvements','How to increase vehicle traffic','Which combination to use where space is limited','Which buildings to make taller'],3,'The last sentence links clearer evidence to choosing a combination of improvements on streets with less space.')
  ) as items(position,part,prompt,choices,key,explanation) loop
    insert into public.questions(test_id,prompt,options,position,group_name)
    values(form_id,item.prompt,to_jsonb(item.choices),item.position,'Passage '||item.part)
    returning id into question_id;
    insert into public.answer_keys(question_id,answer,accepted,explanation)
    values(question_id,item.choices[item.key],to_jsonb(item.choices[item.key]),item.explanation);
  end loop;
end
$seed$;
